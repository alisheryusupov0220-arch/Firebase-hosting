'use client';

import React, { useState, useRef, useTransition, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Badge } from '@/components/ui/badge';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { useToast } from '@/hooks/use-toast';
import { useFirebase, useMemoFirebase } from '@/firebase/provider';
import { useCollection, useFirestore } from '@/firebase/hooks';
import { collection, query, orderBy, where, getDocs } from 'firebase/firestore';
import { type Storage } from '@/lib/poster';
import { type ERPItem } from '@/lib/types/erp';
import { type Contractor } from '@/lib/types/finance';
import { runReceiptOCRAction, uploadSupplyImageAction } from '@/app/actions/ai-ocr-actions';
import { getSmartIngredientMatchesAction, getSupplierPriceHistoryAction } from '@/app/actions/ai-matching-actions';
import { confirmPhotoReceptionAction } from '@/app/supplies/actions';
import { Camera, Plus, Minus, CheckCircle, AlertTriangle, RefreshCw, Sparkles, ArrowRight, ArrowLeft, Building2, Clock, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type ScannedItem = {
    itemId: string;
    originalName: string; // The raw name extracted by OCR
    name: string; // The clean name for creation if it's a new ingredient (editable)
    invoiceQty: number;
    factQty: any; // Allow empty string or number
    price: number;
};

const normalizeCompanyName = (name: string): string => {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9а-яё]/gi, '')
        .replace(/ooo|ooo|ип|чп|сп|ятт|yatt|mchj/g, '')
        .trim();
};

const getCompanyTokens = (name: string): string[] => {
    if (!name) return [];
    return name
        .toLowerCase()
        .replace(/[^a-z0-9а-яё\s]/gi, ' ')
        .split(/\s+/)
        .map(t => t.trim())
        .filter(t => t.length > 0 && !['ooo', 'ооо', 'ип', 'чп', 'сп', 'ятт', 'yatt', 'mchj'].includes(t));
};

const calculateSupplierMatchScore = (detectedName: string, detectedInn: string, supplier: Contractor): number => {
    // 1. INN Match (highest priority)
    if (detectedInn && supplier.inn && String(supplier.inn).trim() === String(detectedInn).trim()) {
        return 1000;
    }

    if (!detectedName) return 0;

    const normDetected = normalizeCompanyName(detectedName);
    const normName = normalizeCompanyName(supplier.name);
    const normLegalName = supplier.legalName ? normalizeCompanyName(supplier.legalName) : '';
    const normBrandName = supplier.brandName ? normalizeCompanyName(supplier.brandName) : '';

    // 2. Exact normalized matches
    if (normName === normDetected) return 500;
    if (normLegalName === normDetected) return 400;
    if (normBrandName === normDetected) return 350;
    
    if (supplier.aliases && Array.isArray(supplier.aliases)) {
        for (const alias of supplier.aliases) {
            if (normalizeCompanyName(alias) === normDetected) {
                return 300;
            }
        }
    }

    // 3. Token overlap match
    const detectedTokens = getCompanyTokens(detectedName);
    if (detectedTokens.length === 0) return 0;

    const checkNames = [
        supplier.name,
        supplier.legalName || '',
        supplier.brandName || '',
        ...(supplier.aliases || [])
    ].filter(Boolean);

    let maxOverlapRatio = 0;
    let maxMatchCount = 0;

    for (const nameToTest of checkNames) {
        const candidateTokens = getCompanyTokens(nameToTest);
        if (candidateTokens.length === 0) continue;

        const matchCount = detectedTokens.filter(t => candidateTokens.includes(t)).length;
        if (matchCount > 0) {
            const ratio = matchCount / detectedTokens.length;
            if (ratio > maxOverlapRatio) {
                maxOverlapRatio = ratio;
                maxMatchCount = matchCount;
            }
        }
    }

    const isValidMatch = detectedTokens.length === 1 
        ? (maxMatchCount === 1 && detectedTokens[0].length > 2) 
        : (maxOverlapRatio >= 0.5 || maxMatchCount >= 2);

    if (isValidMatch) {
        return Math.round(maxOverlapRatio * 200);
    }

    return 0;
};

export function ReceptionClient({
    storages,
    suppliers: posterSuppliers
}: {
    storages: Storage[];
    suppliers: any[];
}) {
    const { toast } = useToast();
    const { orgId, user } = useFirebase();
    const firestore = useFirestore();

    // 1. Fetch local items and suppliers
    const ingredientsQuery = useMemoFirebase(() => {
        if (!firestore || !orgId) return null;
        return query(collection(firestore, 'organizations', orgId, 'erp_items'), orderBy('name', 'asc'));
    }, [firestore, orgId]);

    const suppliersQuery = useMemoFirebase(() => {
        if (!firestore || !orgId) return null;
        return query(collection(firestore, 'organizations', orgId, 'contractors'), orderBy('name', 'asc'));
    }, [firestore, orgId]);

    const { data: erpItems } = useCollection<ERPItem>(ingredientsQuery, { once: true });
    const { data: suppliers } = useCollection<Contractor>(suppliersQuery, { once: true });

    const itemOptions = useMemo(() => {
        const base = (erpItems || []).map(item => ({ value: item.id, label: item.name }));
        return [
            { value: '', label: 'Выберите ингредиент для привязки...' },
            ...base
        ];
    }, [erpItems]);
    const supplierOptions = useMemo(() => (suppliers || []).map(s => ({ 
        value: s.id, 
        label: s.alias ? `${s.alias} (${s.name})` : s.name 
    })), [suppliers]);

    const availableItemOptions = useMemo(() => {
        const options: { value: string; label: string }[] = [];

        if (contractorItems && contractorItems.length > 0) {
            contractorItems.forEach(ci => {
                const erp = erpItems?.find(i => i.id === ci.linkedErpItemId);
                options.push({
                    value: `ci_${ci.id}`,
                    label: `⭐ ${ci.supplierName} (Poster: ${erp?.name || 'не указан'})`
                });
            });
        }

        if (erpItems && erpItems.length > 0) {
            erpItems.forEach(item => {
                options.push({
                    value: `erp_${item.id}`,
                    label: `📦 ${item.name}`
                });
            });
        }

        return options;
    }, [contractorItems, erpItems]);

    // Step state
    // 1: Setup & Camera (Choose supplier, storage, take photo)
    // 2: Verifying (Item verification, entering actual factual quantities)
    const [step, setStep] = useState(1);
    const [supplierId, setSupplierId] = useState('');
    const [scannedSupplierName, setScannedSupplierName] = useState('');
    const [ocrSupplierName, setOcrSupplierName] = useState('');
    
    // OCR Extracted Supplier details:
    const [scannedSupplierInn, setScannedSupplierInn] = useState('');
    const [scannedSupplierBankAccount, setScannedSupplierBankAccount] = useState('');
    const [scannedSupplierBankName, setScannedSupplierBankName] = useState('');
    const [scannedSupplierBankCode, setScannedSupplierBankCode] = useState('');
    const [scannedSupplierPhone, setScannedSupplierPhone] = useState('');
    const [scannedSupplierAddress, setScannedSupplierAddress] = useState('');
    const [photoUrl, setPhotoUrl] = useState('');

    const [scannedItems, setScannedItems] = useState<ScannedItem[]>([]);
    const [priceHistory, setPriceHistory] = useState<Record<string, { date: string; pricePerUnit: number; qty: number }[]>>({});
    const [comment, setComment] = useState('');
    const [isScanning, setIsScanning] = useState(false);
    const [isPending, startTransition] = useTransition();
    const [contractorItems, setContractorItems] = useState<any[]>([]);

    useEffect(() => {
        if (orgId && supplierId && step === 2) {
            getSupplierPriceHistoryAction(orgId, supplierId)
                .then(setPriceHistory)
                .catch(err => console.error("Failed to load supplier price history:", err));
        } else {
            setPriceHistory({});
        }
    }, [orgId, supplierId, step]);

    useEffect(() => {
        if (!orgId || !supplierId || !firestore || step !== 2) {
            setContractorItems([]);
            return;
        }
        const q = query(
            collection(firestore, 'organizations', orgId, 'contractor_items'),
            where('contractorId', '==', supplierId)
        );
        getDocs(q).then((snap) => {
            const items = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setContractorItems(items);
        }).catch(err => console.error("Failed to load contractor items:", err));
    }, [orgId, supplierId, firestore, step]);

    const fileInputRef = useRef<HTMLInputElement>(null);

    const canSubmit = useMemo(() => {
        return scannedItems.length > 0 && scannedItems.every(it => 
            it.itemId !== undefined && 
            it.itemId !== null && 
            it.itemId !== '' && 
            it.factQty !== undefined && 
            it.factQty !== null && 
            it.factQty !== '' && 
            !isNaN(Number(String(it.factQty).replace(',', '.')))
        );
    }, [scannedItems]);

    const hasUnlinkedItems = useMemo(() => {
        return scannedItems.some(it => !it.itemId);
    }, [scannedItems]);

    const hasEmptyFacts = useMemo(() => {
        return scannedItems.some(it => 
            it.factQty === undefined || 
            it.factQty === null || 
            it.factQty === '' || 
            isNaN(Number(String(it.factQty).replace(',', '.')))
        );
    }, [scannedItems]);

    const compressImage = (file: File, maxWidth = 1600, maxHeight = 1600, quality = 0.8): Promise<{ base64: string; mimeType: string }> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;

                    if (width > height) {
                        if (width > maxWidth) {
                            height = Math.round((height * maxWidth) / width);
                            width = maxWidth;
                        }
                    } else {
                        if (height > maxHeight) {
                            width = Math.round((width * maxHeight) / height);
                            height = maxHeight;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;

                    const ctx = canvas.getContext('2d');
                    if (!ctx) {
                        reject(new Error('Failed to get canvas 2d context'));
                        return;
                    }

                    ctx.drawImage(img, 0, 0, width, height);
                    const dataUrl = canvas.toDataURL('image/jpeg', quality);
                    const base64 = dataUrl.split(',')[1];
                    resolve({ base64, mimeType: 'image/jpeg' });
                };
                img.onerror = (err) => reject(err);
                img.src = e.target?.result as string;
            };
            reader.onerror = (err) => reject(err);
            reader.readAsDataURL(file);
        });
    };

    const handlePhotoCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!orgId) {
            toast({ variant: 'destructive', title: 'Ошибка', description: 'Организация не определена.' });
            return;
        }

        setIsScanning(true);
        try {
            // Сжимаем фото на клиенте до приемлемого разрешения для ускорения загрузки и обхода лимитов размера payload
            const { base64, mimeType } = await compressImage(file);
            
            // Upload image to Firebase Storage
            try {
                const fileName = `reception_${orgId}_${Date.now()}.jpg`;
                const uploadResult = await uploadSupplyImageAction(base64, fileName, mimeType);
                if (uploadResult && uploadResult.url) {
                    setPhotoUrl(uploadResult.url);
                    console.log("Photo uploaded to Firebase Storage:", uploadResult.url);
                }
            } catch (uploadError) {
                console.error("Failed to upload reception photo:", uploadError);
            }

            setScannedItems([]);
            setStep(2);
            toast({ title: 'Фото сохранено!', description: 'Фотография накладной успешно прикреплена. Введите позиции вручную.' });
        } catch (err: any) {
            console.error("Error uploading image:", err);
            toast({ variant: 'destructive', title: 'Ошибка загрузки фото', description: err.message || String(err) });
        } finally {
            setIsScanning(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleAddItem = () => {
        setScannedItems(prev => [
            ...prev,
            {
                itemId: '',
                originalName: '',
                name: '',
                invoiceQty: 1,
                factQty: '',
                price: 0,
            }
        ]);
    };

    const handleRemoveItem = (index: number) => {
        setScannedItems(prev => prev.filter((_, idx) => idx !== index));
    };

    const handleUpdateItemField = (index: number, field: keyof ScannedItem, value: any) => {
        const updated = [...scannedItems];
        updated[index] = {
            ...updated[index],
            [field]: value
        };
        // Auto-update clean name if itemId changes
        if (field === 'itemId') {
            const erpItem = erpItems?.find(i => i.id === value);
            if (erpItem) {
                updated[index].name = erpItem.name;
            }
        }
        setScannedItems(updated);
    };

    const handleSelectCombinedItem = (index: number, val: string) => {
        if (!val) {
            setScannedItems(prev => {
                const next = [...prev];
                next[index] = {
                    ...next[index],
                    itemId: '',
                    originalName: '',
                    name: ''
                };
                return next;
            });
            return;
        }

        if (val.startsWith('ci_')) {
            const ciId = val.replace('ci_', '');
            const ci = contractorItems.find(c => c.id === ciId);
            if (ci) {
                const erp = erpItems?.find(i => i.id === ci.linkedErpItemId);
                setScannedItems(prev => {
                    const next = [...prev];
                    next[index] = {
                        ...next[index],
                        itemId: ci.linkedErpItemId,
                        originalName: ci.supplierName,
                        name: erp?.name || ci.supplierName
                    };
                    return next;
                });
            }
        } else if (val.startsWith('erp_')) {
            const erpId = val.replace('erp_', '');
            const erp = erpItems?.find(i => i.id === erpId);
            if (erp) {
                setScannedItems(prev => {
                    const next = [...prev];
                    next[index] = {
                        ...next[index],
                        itemId: erp.id,
                        originalName: erp.name,
                        name: erp.name
                    };
                    return next;
                });
            }
        }
    };

    const handleConfirmReception = () => {
        if (!orgId || !user) return;

        startTransition(async () => {
            const res = await confirmPhotoReceptionAction(orgId, user.uid, {
                supplierId: supplierId || undefined,
                supplierName: scannedSupplierName || undefined,
                originalSupplierName: ocrSupplierName || undefined,
                storageId: undefined,
                comment,
                photoUrl: photoUrl || undefined,
                isPaid: false,
                supplierInn: scannedSupplierInn || undefined,
                supplierBankAccount: scannedSupplierBankAccount || undefined,
                supplierBankName: scannedSupplierBankName || undefined,
                supplierBankCode: scannedSupplierBankCode || undefined,
                supplierPhone: scannedSupplierPhone || undefined,
                supplierAddress: scannedSupplierAddress || undefined,
                items: scannedItems.map(it => ({
                    itemId: it.itemId || undefined,
                    name: it.name,
                    originalName: it.originalName,
                    invoiceQty: it.invoiceQty,
                    factQty: Number(String(it.factQty).replace(',', '.')),
                    price: it.price
                }))
            });

            if (res.success) {
                toast({ title: 'Приемка завершена!', description: `Поставка успешно внесена в Poster (ID: ${res.posterSupplyId}) и отправлена в отчетный чат.` });
                // Reset form
                setStep(1);
                setSupplierId('');
                setScannedSupplierName('');
                setOcrSupplierName('');
                setScannedSupplierInn('');
                setScannedSupplierBankAccount('');
                setScannedSupplierBankName('');
                setScannedSupplierBankCode('');
                setScannedSupplierPhone('');
                setScannedSupplierAddress('');
                setPhotoUrl('');
                setScannedItems([]);
                setComment('');
            } else {
                toast({ variant: 'destructive', title: 'Ошибка проводки', description: res.message });
            }
        });
    };

    return (
        <div className="space-y-6 max-w-3xl mx-auto p-4 pb-24">
            {/* Steps indicator */}
            <div className="flex items-center justify-between px-4 py-2 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-100 dark:border-slate-800">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Шаги приемки:</span>
                <div className="flex items-center gap-4">
                    <span className={cn("text-xs font-black", step === 1 ? "text-blue-600" : "text-slate-400 dark:text-slate-500")}>1. Контрагент</span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                    <span className={cn("text-xs font-black", step === 2 ? "text-blue-600" : "text-slate-400 dark:text-slate-500")}>2. Снимок</span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                    <span className={cn("text-xs font-black", step === 3 ? "text-blue-600" : "text-slate-400 dark:text-slate-500")}>3. Товары</span>
                </div>
            </div>

            {step === 1 && (
                <Card className="rounded-[2rem] shadow-xl border-none">
                    <CardHeader className="bg-slate-50 dark:bg-slate-900/40 border-b p-6 rounded-t-[2rem]">
                        <CardTitle className="text-lg font-bold flex items-center gap-2">
                            <Building2 className="w-5 h-5 text-blue-600" /> Шаг 1: Поставщик и Склад
                        </CardTitle>
                        <CardDescription>
                            Выберите контрагента, склад разгрузки и статус оплаты.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="p-8 space-y-6">
                        <div className="space-y-6">
                            <div className="space-y-2">
                                <Label className="text-xs font-bold uppercase text-slate-400 ml-1">Поставщик (FLOW)</Label>
                                <SearchableSelect 
                                    options={supplierOptions} 
                                    value={supplierId} 
                                    onChange={(val) => {
                                        setSupplierId(val);
                                        if (val) {
                                            const selected = suppliers?.find(s => s.id === val);
                                            setScannedSupplierName(selected?.name || '');
                                        }
                                    }} 
                                    placeholder="От кого товары?" 
                                />
                            </div>
                        </div>

                        <Button 
                            type="button"
                            onClick={() => setStep(2)}
                            disabled={!supplierId}
                            className="w-full h-14 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold uppercase text-xs tracking-wider shadow-lg shadow-blue-100 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            Далее: Сделать фото накладной <ArrowRight className="w-4 h-4" />
                        </Button>
                    </CardContent>
                </Card>
            )}

            {step === 2 && (
                <Card className="rounded-[2rem] shadow-xl border-none">
                    <CardHeader className="bg-slate-50 dark:bg-slate-900/40 border-b p-6 rounded-t-[2rem] flex flex-row items-center justify-between">
                        <div>
                            <CardTitle className="text-lg font-bold flex items-center gap-2">
                                <Camera className="w-5 h-5 text-blue-600" /> Шаг 2: Снимок накладной
                            </CardTitle>
                            <CardDescription>
                                Сделайте фото чека или накладной для отчета.
                            </CardDescription>
                        </div>
                        <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => setStep(1)} 
                            className="rounded-xl font-bold text-xs"
                        >
                            <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Назад
                        </Button>
                    </CardHeader>
                    <CardContent className="p-8 space-y-6">
                        <input 
                            type="file" 
                            ref={fileInputRef} 
                            accept="image/*" 
                            capture="environment" 
                            className="hidden" 
                            onChange={handlePhotoCapture} 
                        />

                        <Button 
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isScanning}
                            className="w-full h-32 rounded-3xl bg-blue-600 hover:bg-blue-700 text-white flex flex-col items-center justify-center gap-2 shadow-lg shadow-blue-200 transition-all active:scale-[0.98] disabled:opacity-50"
                        >
                            {isScanning ? (
                                <>
                                    <RefreshCw className="w-8 h-8 animate-spin" />
                                    <span className="font-bold text-sm uppercase tracking-wide">Загрузка фото...</span>
                                </>
                            ) : (
                                <>
                                    <Camera className="w-8 h-8 text-white animate-pulse" />
                                    <span className="font-bold text-sm uppercase tracking-wide">Сделать фото накладной</span>
                                    <span className="text-[10px] opacity-70">Запустит камеру устройства</span>
                                </>
                            )}
                        </Button>

                        <div className="flex gap-2">
                            <Button 
                                type="button"
                                variant="outline"
                                onClick={() => {
                                    setPhotoUrl('');
                                    setScannedItems([]);
                                    setStep(3);
                                    toast({ title: 'Пропущено', description: 'Перешли к ручному вводу без фото накладной.' });
                                }}
                                className="w-full h-12 rounded-xl text-slate-500 dark:text-slate-400 font-bold text-xs uppercase"
                            >
                                Пропустить фото и ввести вручную
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {step === 3 && (
                <div className="space-y-6">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                        <Button 
                            variant="ghost" 
                            onClick={() => setStep(2)} 
                            className="rounded-xl font-bold hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                            <ArrowLeft className="w-4 h-4 mr-2" /> Назад к фото
                        </Button>
                        <Badge className="bg-amber-100 text-amber-800 border-none font-bold">
                            Шаг 3: Ввод товаров
                        </Badge>
                    </div>

                    {/* Image Preview Reference Card */}
                    {photoUrl && (
                        <Card className="rounded-[2rem] shadow-xl border-none overflow-hidden">
                            <CardHeader className="bg-slate-50 dark:bg-slate-900/40 border-b p-4">
                                <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                                    Фото накладной (для сверки)
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-4 flex justify-center bg-slate-950/5 dark:bg-slate-950/20">
                                <img 
                                    src={photoUrl} 
                                    alt="Накладная" 
                                    className="max-h-[260px] object-contain rounded-2xl border border-slate-200 dark:border-slate-800" 
                                />
                            </CardContent>
                        </Card>
                    )}

                    {/* Items List */}
                    <Card className="rounded-[2rem] shadow-xl border-none">
                        <CardHeader className="bg-slate-50 dark:bg-slate-900/40 border-b p-6 rounded-t-[2rem] flex flex-row items-center justify-between">
                            <div>
                                <CardTitle className="text-lg">Товары в накладной</CardTitle>
                                <CardDescription>Заполните номенклатуру поставщика, сопоставьте с Poster и укажите цены.</CardDescription>
                            </div>
                            <Button 
                                type="button" 
                                variant="outline" 
                                size="sm" 
                                onClick={handleAddItem}
                                className="rounded-xl border-blue-500 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/20 font-bold flex items-center gap-1"
                            >
                                <Plus className="w-4 h-4" /> Добавить товар
                            </Button>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="divide-y divide-slate-100 dark:divide-slate-800">
                                {scannedItems.length === 0 ? (
                                    <div className="p-12 text-center text-slate-400 dark:text-slate-500">
                                        <p className="font-bold mb-3 text-sm">В накладной пока нет добавленных товаров.</p>
                                        <Button 
                                            type="button" 
                                            variant="outline" 
                                            onClick={handleAddItem}
                                            className="rounded-xl font-bold text-xs uppercase"
                                        >
                                            <Plus className="w-4 h-4 mr-1" /> Добавить первую позицию
                                        </Button>
                                    </div>
                                ) : (
                                    scannedItems.map((item, index) => {
                                        const factNum = item.factQty !== '' ? Number(String(item.factQty).replace(',', '.')) : 0;
                                        const diff = factNum - item.invoiceQty;
                                        const hasDiff = diff !== 0;
                                        const erpItem = erpItems?.find(i => i.id === item.itemId);

                                        // Calculate unit prices for historical analysis
                                        const currentQty = (item.factQty !== '' && !isNaN(Number(String(item.factQty).replace(',', '.'))))
                                            ? Number(String(item.factQty).replace(',', '.'))
                                            : item.invoiceQty || 1;
                                        const currentUnitPrice = item.price / (currentQty || 1);
                                        const historyEntries = item.itemId ? priceHistory[item.itemId] : undefined;
                                        const lastEntry = historyEntries && historyEntries.length > 0 ? historyEntries[0] : undefined;
                                        
                                        let priceDiff = 0;
                                        let priceDiffPercent = 0;
                                        if (lastEntry) {
                                            priceDiff = currentUnitPrice - lastEntry.pricePerUnit;
                                            priceDiffPercent = lastEntry.pricePerUnit > 0 ? (priceDiff / lastEntry.pricePerUnit) * 100 : 0;
                                        }

                                        let selectedCombinedValue = '';
                                        if (item.itemId) {
                                            const matchingCi = contractorItems.find(ci => ci.linkedErpItemId === item.itemId && (ci.supplierName === item.originalName || !item.originalName));
                                            if (matchingCi) {
                                                selectedCombinedValue = `ci_${matchingCi.id}`;
                                            } else {
                                                selectedCombinedValue = `erp_${item.itemId}`;
                                            }
                                        }

                                        return (
                                            <div key={index} className="p-6 space-y-4 hover:bg-slate-50/50 dark:hover:bg-slate-900/20 transition-colors border-b border-slate-100 dark:border-slate-800">
                                                {/* Header & Item Selection */}
                                                <div className="flex justify-between items-start gap-4">
                                                    <div className="flex-1 space-y-3">
                                                        <div className="space-y-1">
                                                            <label className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider ml-0.5">
                                                                Товар / Ингредиент:
                                                            </label>
                                                            <SearchableSelect 
                                                                options={availableItemOptions} 
                                                                value={selectedCombinedValue} 
                                                                onChange={(val) => handleSelectCombinedItem(index, val)} 
                                                                placeholder="Выберите товар из списка..." 
                                                            />
                                                        </div>
                                                    </div>

                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => handleRemoveItem(index)}
                                                        className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl h-10 w-10 mt-5"
                                                    >
                                                        <Trash2 className="w-5 h-5" />
                                                    </Button>
                                                </div>

                                                {/* Price/History details */}
                                                {item.itemId && (
                                                    <div className="pt-3 border-t border-slate-100/80 dark:border-slate-800/80 space-y-2 animate-in fade-in duration-300">
                                                        <div className="flex items-center justify-between text-xs">
                                                            <span className="text-slate-400 dark:text-slate-500 font-bold flex items-center gap-1">
                                                                <Sparkles className="w-3.5 h-3.5 text-blue-500" />
                                                                Расчетная цена за {erpItem?.baseUnit === 'KG' ? 'кг' : 'шт'}:
                                                            </span>
                                                            <div className="font-black text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-lg">
                                                                {Math.round(currentUnitPrice).toLocaleString()} сум / {erpItem?.baseUnit === 'KG' ? 'кг' : 'шт'}
                                                            </div>
                                                        </div>

                                                        {lastEntry ? (
                                                            <div className="flex flex-col gap-1.5 bg-slate-50 dark:bg-slate-900/60 p-3 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
                                                                <div className="flex items-center justify-between text-xs">
                                                                    <span className="text-slate-500 dark:text-slate-400 font-semibold">Предыдущая поставка ({lastEntry.date}):</span>
                                                                    <div className="flex items-center gap-1.5 font-bold">
                                                                        <span>{Math.round(lastEntry.pricePerUnit).toLocaleString()} сум</span>
                                                                        {priceDiff !== 0 ? (
                                                                            <span className={cn(
                                                                                "px-1.5 py-0.5 rounded-lg text-[10px] font-black leading-none",
                                                                                priceDiff > 0 ? "bg-rose-50 text-rose-600 border border-rose-100" : "bg-emerald-50 text-emerald-600 border border-emerald-100"
                                                                            )}>
                                                                                {priceDiff > 0 ? `📈 +${priceDiffPercent.toFixed(1)}%` : `📉 ${priceDiffPercent.toFixed(1)}%`}
                                                                            </span>
                                                                        ) : (
                                                                            <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-1.5 py-0.5 rounded-lg text-[10px] font-black leading-none">
                                                                                ➡️ Без изменений
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                                
                                                                {historyEntries && historyEntries.length > 1 && (
                                                                    <div className="pt-2 mt-1 border-t border-slate-200/50 dark:border-slate-800/50">
                                                                        <div className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">История последних закупок у этого поставщика:</div>
                                                                        <div className="grid grid-cols-1 gap-1 text-[11px] text-slate-600 dark:text-slate-350 font-medium">
                                                                            {historyEntries.slice(1, 4).map((hist, idx) => (
                                                                                <div key={idx} className="flex justify-between items-center bg-white dark:bg-slate-950 px-2 py-1 rounded-lg border border-slate-100 dark:border-slate-850">
                                                                                    <span className="text-slate-400 dark:text-slate-500 text-[10px]">{hist.date} (пост. {hist.qty} {erpItem?.baseUnit === 'KG' ? 'кг' : 'шт'}):</span>
                                                                                    <span className="font-bold text-slate-700 dark:text-slate-200">{Math.round(hist.pricePerUnit).toLocaleString()} сум</span>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <div className="text-[10px] text-slate-400 dark:text-slate-500 italic pl-1 bg-slate-50/50 dark:bg-slate-900/20 p-2 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                                                                История поставок этого товара от данного поставщика отсутствует в системе.
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                {!item.itemId && (
                                                    <div className="text-xs font-semibold text-rose-600 bg-rose-50 p-2.5 rounded-xl border border-rose-100 flex items-center gap-1.5 animate-in slide-in-from-top-1 duration-200">
                                                        <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                                                        Пожалуйста, свяжите этот товар с ингредиентом из Poster для проведения накладной!
                                                    </div>
                                                )}

                                                {/* Quantities & Price Grid */}
                                                <div className="grid grid-cols-3 gap-3 bg-slate-50 dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                                                    <div className="space-y-1">
                                                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Кол-во по накл.</span>
                                                        <Input 
                                                            type="number"
                                                            value={item.invoiceQty || ''}
                                                            onChange={(e) => handleUpdateItemField(index, 'invoiceQty', Number(e.target.value))}
                                                            placeholder="1"
                                                            className="h-10 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 font-black text-center text-xs w-full focus-visible:ring-blue-500"
                                                        />
                                                    </div>

                                                    <div className="space-y-1">
                                                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Кол-во по факту</span>
                                                        <Input 
                                                            type="text"
                                                            inputMode="decimal"
                                                            value={item.factQty}
                                                            onChange={(e) => {
                                                                const val = e.target.value;
                                                                if (val === '' || /^\d*[.,]?\d*$/.test(val)) {
                                                                    handleUpdateItemField(index, 'factQty', val);
                                                                }
                                                            }}
                                                            placeholder="1"
                                                            className={cn(
                                                                "h-10 rounded-xl border bg-white dark:bg-slate-950 font-black text-center text-xs w-full focus-visible:ring-blue-500",
                                                                item.factQty === '' ? "border-amber-300 bg-amber-50/10" : "border-slate-200 dark:border-slate-800"
                                                            )}
                                                        />
                                                    </div>

                                                    <div className="space-y-1">
                                                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Общая сумма</span>
                                                        <Input 
                                                            type="number"
                                                            value={item.price || ''}
                                                            onChange={(e) => handleUpdateItemField(index, 'price', Number(e.target.value))}
                                                            placeholder="0"
                                                            className="h-10 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 font-black text-center text-xs w-full focus-visible:ring-blue-500"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Comment & Submit */}
                    <Card className="rounded-[2rem] shadow-xl border-none overflow-hidden">
                        <CardContent className="p-8 space-y-6">
                            <div className="space-y-2">
                                <Label className="text-xs font-bold uppercase text-slate-400 dark:text-slate-500 ml-1">Комментарий к приёмке (Audit)</Label>
                                <Textarea 
                                    value={comment} 
                                    onChange={(e) => setComment(e.target.value)} 
                                    placeholder="Например: Недовоз 2кг картофеля, водитель согласился..." 
                                    className="rounded-2xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100"
                                />
                            </div>

                            {!canSubmit && scannedItems.length > 0 && (
                                <div className="text-center text-[10px] font-black uppercase tracking-wide text-rose-600 bg-rose-50 p-3.5 rounded-2xl border border-rose-100 flex items-center justify-center gap-1.5 animate-in slide-in-from-bottom-2 duration-300">
                                    <AlertTriangle className="w-4 h-4" />
                                    {hasUnlinkedItems && hasEmptyFacts && (
                                        <span>Свяжите все товары с Poster и заполните фактическое количество (Факт)!</span>
                                    )}
                                    {hasUnlinkedItems && !hasEmptyFacts && (
                                        <span>Свяжите все товары с Poster для проведения поставки!</span>
                                    )}
                                    {!hasUnlinkedItems && hasEmptyFacts && (
                                        <span>Заполните фактическое количество (Факт) для всех позиций!</span>
                                    )}
                                </div>
                            )}

                            <Button 
                                onClick={handleConfirmReception}
                                disabled={isPending || !canSubmit}
                                className="w-full h-16 rounded-3xl bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-xs tracking-wider shadow-lg shadow-emerald-100 transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {isPending ? (
                                    <>
                                        <RefreshCw className="w-4 h-4 animate-spin mr-2" /> Проведение поставки...
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle className="w-5 h-5" /> Подтвердить и провести
                                    </>
                                )}
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}
