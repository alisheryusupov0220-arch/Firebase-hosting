'use client';

import React, { useState, useRef, useTransition, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useFirebase, useMemoFirebase } from '@/firebase/provider';
import { useCollection, useFirestore } from '@/firebase/hooks';
import { collection, query, orderBy } from 'firebase/firestore';
import { type Storage } from '@/lib/poster';
import { type ERPItem } from '@/lib/types/erp';
import { type Contractor } from '@/lib/types/finance';
import { runReceiptOCRAction, uploadSupplyImageAction } from '@/app/actions/ai-ocr-actions';
import { getSmartIngredientMatchesAction, getSupplierPriceHistoryAction } from '@/app/actions/ai-matching-actions';
import { confirmPhotoReceptionAction } from '@/app/supplies/actions';
import { Camera, Plus, Minus, CheckCircle, AlertTriangle, RefreshCw, Sparkles, ArrowRight, ArrowLeft, Building2, Clock } from 'lucide-react';
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

    const { data: erpItems } = useCollection<ERPItem>(ingredientsQuery);
    const { data: suppliers } = useCollection<Contractor>(suppliersQuery);

    const itemOptions = useMemo(() => {
        const base = (erpItems || []).map(item => ({ value: item.id, label: item.name }));
        return [
            { value: '', label: 'Выберите ингредиент для привязки...' },
            ...base
        ];
    }, [erpItems]);
    const supplierOptions = useMemo(() => (suppliers || []).map(s => ({ value: s.id, label: s.name })), [suppliers]);
    const storageOptions = useMemo(() => {
        const baseOptions = (storages || []).map(s => ({ value: String(s.storage_id), label: s.storage_name }));
        return [
            { value: '', label: 'Автовыбор склада (Авто)' },
            ...baseOptions
        ];
    }, [storages]);

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

    const [storageId, setStorageId] = useState('');
    const [scannedItems, setScannedItems] = useState<ScannedItem[]>([]);
    const [priceHistory, setPriceHistory] = useState<Record<string, { date: string; pricePerUnit: number; qty: number }[]>>({});
    const [comment, setComment] = useState('');
    const [isScanning, setIsScanning] = useState(false);
    const [isPending, startTransition] = useTransition();

    useEffect(() => {
        if (orgId && supplierId && step === 2) {
            getSupplierPriceHistoryAction(orgId, supplierId)
                .then(setPriceHistory)
                .catch(err => console.error("Failed to load supplier price history:", err));
        } else {
            setPriceHistory({});
        }
    }, [orgId, supplierId, step]);

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
            
            // 1. OCR Extract
            const result = await runReceiptOCRAction(base64, mimeType, orgId);
            if (!result || !result.items || result.items.length === 0) {
                toast({ variant: 'destructive', title: 'Накладная не распознана', description: 'Попробуйте сделать фото еще раз при хорошем освещении.' });
                return;
            }

            const detectedName = result.counterparty || '';
            setScannedSupplierName(detectedName);
            setOcrSupplierName(detectedName);
            setScannedSupplierInn(result.counterpartyInn || result.inn || '');
            setScannedSupplierBankAccount(result.senderAccount || result.bankAccount || '');
            setScannedSupplierBankName(result.bankName || '');
            setScannedSupplierBankCode(result.mfo || '');
            setScannedSupplierPhone(result.phone || '');
            setScannedSupplierAddress(result.address || '');

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

            // Auto-resolve supplier if possible using smart scoring matching
            let resolvedSupplierId = supplierId;
            const scannedInn = result.counterpartyInn || result.inn || '';
            
            if (!resolvedSupplierId && suppliers && suppliers.length > 0) {
                let bestScore = 0;
                let bestMatchSupplier = null;

                for (const supplier of suppliers) {
                    const score = calculateSupplierMatchScore(detectedName, scannedInn, supplier);
                    if (score > bestScore) {
                        bestScore = score;
                        bestMatchSupplier = supplier;
                    }
                }

                if (bestMatchSupplier && bestScore > 0) {
                    console.log(`Auto-matched supplier: ${bestMatchSupplier.name} (Score: ${bestScore})`);
                    resolvedSupplierId = bestMatchSupplier.id;
                    setSupplierId(bestMatchSupplier.id);
                    setScannedSupplierName(bestMatchSupplier.name);
                }
            }

            // Fallback: Auto-resolve supplier by checking scanned item name matches in suppliers' priceLists
            if (!resolvedSupplierId && suppliers && suppliers.length > 0 && result.items && result.items.length > 0) {
                let bestSupplierId = '';
                let maxMatchCount = 0;

                for (const supplier of suppliers) {
                    if (supplier.priceList && supplier.priceList.length > 0) {
                        let matchCount = 0;
                        for (const scannedItem of result.items) {
                            const normScanned = normalizeCompanyName(scannedItem.name);
                            const hasMatch = supplier.priceList.some(plItem => normalizeCompanyName(plItem.name) === normScanned);
                            if (hasMatch) {
                                matchCount++;
                            }
                        }
                        if (matchCount > maxMatchCount) {
                            maxMatchCount = matchCount;
                            bestSupplierId = supplier.id;
                        }
                    }
                }

                if (bestSupplierId && maxMatchCount > 0) {
                    const matchedSupplier = suppliers.find(s => s.id === bestSupplierId);
                    if (matchedSupplier) {
                        console.log(`Auto-matched supplier by priceList item matches: ${matchedSupplier.name} (matched items: ${maxMatchCount})`);
                        resolvedSupplierId = bestSupplierId;
                        setSupplierId(bestSupplierId);
                        setScannedSupplierName(matchedSupplier.name);
                    }
                }
            }

            // 2. AI Matching
            const matches = await getSmartIngredientMatchesAction(orgId, result.items, resolvedSupplierId || undefined);
            
            // 3. Populate Form State
            const itemsToVerify: ScannedItem[] = matches.map(m => {
                const scannedItem = result.items?.find(si => si.name === m.scannedName);
                const invoiceQty = scannedItem?.qty ? Number(scannedItem.qty) : 1;
                return {
                    itemId: m.matchedItemId || '',
                    originalName: m.scannedName,
                    name: m.scannedName,
                    invoiceQty,
                    factQty: '', // Awaiting user input
                    price: scannedItem?.sum ? Number(scannedItem.sum) : 0,
                };
            });

            setScannedItems(itemsToVerify);
            setStep(2);
            toast({ title: 'Оцифровка завершена!', description: `Распознано позиций: ${itemsToVerify.length}` });
        } catch (err: any) {
            console.error("Error during OCR/matching:", err);
            toast({ variant: 'destructive', title: 'Ошибка распознавания', description: err.message || String(err) });
        } finally {
            setIsScanning(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };



    const handleItemSelect = (index: number, itemId: string) => {
        const updated = [...scannedItems];
        updated[index].itemId = itemId;
        if (itemId) {
            const erpItem = erpItems?.find(i => i.id === itemId);
            if (erpItem) {
                updated[index].name = erpItem.name;
            }
        }
        setScannedItems(updated);
    };

    const handleConfirmReception = () => {
        if (!orgId || !user) return;

        startTransition(async () => {
            const res = await confirmPhotoReceptionAction(orgId, user.uid, {
                supplierId: supplierId || undefined,
                supplierName: scannedSupplierName || undefined,
                originalSupplierName: ocrSupplierName || undefined,
                storageId: storageId || undefined,
                comment,
                photoUrl: photoUrl || undefined,
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
            <div className="flex items-center justify-between px-4 py-2 bg-slate-50 rounded-2xl border border-slate-100">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Шаги приемки:</span>
                <div className="flex items-center gap-4">
                    <span className={cn("text-sm font-black", step === 1 ? "text-blue-600" : "text-slate-400")}>1. Фото и Склад</span>
                    <ArrowRight className="w-4 h-4 text-slate-300" />
                    <span className={cn("text-sm font-black", step === 2 ? "text-blue-600" : "text-slate-400")}>2. Сверка Факта</span>
                </div>
            </div>

            {step === 1 && (
                <Card className="rounded-[2rem] shadow-xl border-none">
                    <CardHeader className="bg-slate-50 border-b p-6 rounded-t-[2rem]">
                        <CardTitle className="text-lg font-bold flex items-center gap-2">
                            <Camera className="w-5 h-5 text-blue-600" /> Быстрая приемка по фото
                        </CardTitle>
                        <CardDescription>
                            Выберите поставщика, объект и сделайте снимок накладной для оцифровки ИИ.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="p-8 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label className="text-xs font-bold uppercase text-slate-400 ml-1">Поставщик (FLOW)</Label>
                                <SearchableSelect 
                                    options={supplierOptions} 
                                    value={supplierId} 
                                    onChange={setSupplierId} 
                                    placeholder="От кого товары?" 
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs font-bold uppercase text-slate-400 ml-1">Склад / Объект (Poster)</Label>
                                <SearchableSelect 
                                    options={storageOptions} 
                                    value={storageId} 
                                    onChange={setStorageId} 
                                    placeholder="Куда выгружать?" 
                                />
                            </div>
                        </div>

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
                            className="w-full h-24 rounded-3xl bg-blue-600 hover:bg-blue-700 text-white flex flex-col items-center justify-center gap-2 shadow-lg shadow-blue-200 transition-all active:scale-[0.98] disabled:opacity-50"
                        >
                            {isScanning ? (
                                <>
                                    <RefreshCw className="w-8 h-8 animate-spin" />
                                    <span className="font-bold text-sm uppercase tracking-wide">ИИ оцифровывает накладную...</span>
                                </>
                            ) : (
                                <>
                                    <Camera className="w-8 h-8 text-white" />
                                    <span className="font-bold text-sm uppercase tracking-wide">Сделать фото накладной</span>
                                    <span className="text-[10px] opacity-70">Откроется камера планшета/устройства</span>
                                </>
                            )}
                        </Button>
                    </CardContent>
                </Card>
            )}

            {step === 2 && (
                <div className="space-y-6">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                        <Button 
                            variant="ghost" 
                            onClick={() => setStep(1)} 
                            className="rounded-xl font-bold hover:bg-slate-100"
                        >
                            <ArrowLeft className="w-4 h-4 mr-2" /> Сделать новое фото
                        </Button>
                        <Badge className="bg-amber-100 text-amber-800 border-none font-bold">
                            Сверка расхождений
                        </Badge>
                    </div>

                    {/* Contractor & Storage Card */}
                    <Card className="rounded-[2rem] shadow-xl border-none">
                        <CardHeader className="bg-slate-50 border-b p-6 rounded-t-[2rem]">
                            <CardTitle className="text-lg font-bold flex items-center gap-2">
                                <Building2 className="w-5 h-5 text-blue-600" /> Контрагент и Склад
                            </CardTitle>
                            <CardDescription>
                                Проверьте реквизиты поставщика и склад выгрузки.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="p-8 space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                                    {!supplierId && (
                                        <div className="space-y-1.5 mt-2 bg-amber-50/30 p-4 rounded-2xl border border-amber-100 shadow-sm animate-in fade-in duration-300">
                                            <Label className="text-[10px] font-black text-amber-800 uppercase tracking-wider pl-0.5">Название нового контрагента (Бренд/Имя)</Label>
                                            <Input 
                                                value={scannedSupplierName} 
                                                onChange={(e) => setScannedSupplierName(e.target.value)} 
                                                placeholder="Введите название (например, b2b quality)"
                                                className="h-10 rounded-xl border-amber-200 bg-white font-black text-sm pl-3 focus-visible:ring-amber-500 text-slate-800 uppercase"
                                            />
                                            <p className="text-[9px] font-bold text-amber-700/60 leading-tight pl-0.5">
                                                Отредактируйте юридическое имя на понятный бренд (например, b2b quality вместо ЯТТ), чтобы долги группировались правильно.
                                            </p>
                                        </div>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold uppercase text-slate-400 ml-1">Склад / Объект (Poster)</Label>
                                    <SearchableSelect 
                                        options={storageOptions} 
                                        value={storageId} 
                                        onChange={setStorageId} 
                                        placeholder="Автовыбор склада" 
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Items List */}
                    <Card className="rounded-[2rem] shadow-xl border-none">
                        <CardHeader className="bg-slate-50 border-b p-6 rounded-t-[2rem] flex flex-row items-center justify-between">
                            <div>
                                <CardTitle className="text-lg">Проверка и оцифрованный Факт</CardTitle>
                                <CardDescription>Сопоставьте товары и укажите фактическое количество (Факт).</CardDescription>
                            </div>
                            <Sparkles className="w-6 h-6 text-blue-500" />
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="divide-y divide-slate-100">
                                {scannedItems.map((item, index) => {
                                    const diff = item.factQty - item.invoiceQty;
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

                                    return (
                                        <div key={index} className="p-6 space-y-4 hover:bg-slate-50/50 transition-colors">
                                            {/* Line Item Info */}
                                            <div className="flex items-start justify-between gap-4">
                                                <div className="space-y-3 flex-1">
                                                    <div>
                                                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Название в накладной (оригинал)</div>
                                                        <h4 className="text-base font-bold text-slate-900 leading-tight">
                                                            {item.originalName}
                                                        </h4>
                                                    </div>
                                                    
                                                    <div className="space-y-1">
                                                        <label className="text-xs font-semibold text-slate-500 block">
                                                            Связь с ингредиентом Poster:
                                                        </label>
                                                        <SearchableSelect 
                                                            options={itemOptions} 
                                                            value={item.itemId} 
                                                            onChange={(val) => handleItemSelect(index, val)} 
                                                            placeholder="Выберите ингредиент из Poster..." 
                                                        />
                                                    </div>
                                                    
                                                    {item.itemId && (
                                                        <div className="mt-3 pt-3 border-t border-slate-100/80 space-y-2 animate-in fade-in duration-300">
                                                            <div className="flex items-center justify-between text-xs">
                                                                <span className="text-slate-400 font-bold flex items-center gap-1">
                                                                    <Sparkles className="w-3.5 h-3.5 text-blue-500" />
                                                                    Текущая цена за {erpItem?.baseUnit === 'KG' ? 'кг' : 'шт'}:
                                                                </span>
                                                                <div className="font-black text-slate-800 bg-slate-100 px-2 py-0.5 rounded-lg">
                                                                    {Math.round(currentUnitPrice).toLocaleString()} сум / {erpItem?.baseUnit === 'KG' ? 'кг' : 'шт'}
                                                                </div>
                                                            </div>

                                                            {lastEntry ? (
                                                                <div className="flex flex-col gap-1.5 bg-slate-50 p-3 rounded-2xl border border-slate-100 shadow-sm">
                                                                    <div className="flex items-center justify-between text-xs">
                                                                        <span className="text-slate-500 font-semibold">Предыдущая поставка ({lastEntry.date}):</span>
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
                                                                                <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-lg text-[10px] font-black leading-none">
                                                                                    ➡️ Без изменений
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                    
                                                                    {historyEntries && historyEntries.length > 1 && (
                                                                        <div className="pt-2 mt-1 border-t border-slate-200/50">
                                                                            <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">История последних закупок у этого поставщика:</div>
                                                                            <div className="grid grid-cols-1 gap-1 text-[11px] text-slate-600 font-medium">
                                                                                {historyEntries.slice(1, 4).map((hist, idx) => (
                                                                                    <div key={idx} className="flex justify-between items-center bg-white px-2 py-1 rounded-lg border border-slate-100">
                                                                                        <span className="text-slate-400 text-[10px]">{hist.date} (пост. {hist.qty} {erpItem?.baseUnit === 'KG' ? 'кг' : 'шт'}):</span>
                                                                                        <span className="font-bold text-slate-700">{Math.round(hist.pricePerUnit).toLocaleString()} сум</span>
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                <div className="text-[10px] text-slate-400 italic pl-1 bg-slate-50/50 p-2 rounded-xl border border-dashed">
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
                                                </div>
                                                <div className="text-right flex-shrink-0 pt-6">
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase">Сумма (OCR)</span>
                                                    <div className="font-black text-sm text-slate-950">{(item.price).toLocaleString()} сум</div>
                                                </div>
                                            </div>

                                            {/* Quantity Input */}
                                            <div className="flex items-center justify-between bg-slate-50 p-4 rounded-2xl border border-slate-100 gap-4">
                                                <div className="text-xs">
                                                    <span className="text-slate-400 font-bold">Накладная:</span>{' '}
                                                    <span className="font-black text-slate-700">{item.invoiceQty} {erpItem?.baseUnit === 'KG' ? 'кг' : 'шт'}</span>
                                                </div>

                                                <div className="flex items-center gap-2 flex-1 max-w-[200px]">
                                                    <span className="text-xs font-bold text-slate-400 whitespace-nowrap">Принято (Факт):</span>
                                                    <Input 
                                                        type="text"
                                                        inputMode="decimal"
                                                        value={item.factQty}
                                                        onChange={(e) => {
                                                            const val = e.target.value;
                                                            // Match empty string, integers, or decimals (dot/comma allowed)
                                                            if (val === '' || /^\d*[.,]?\d*$/.test(val)) {
                                                                const updated = [...scannedItems];
                                                                updated[index].factQty = val;
                                                                setScannedItems(updated);
                                                            }
                                                        }}
                                                        placeholder="0"
                                                        className={cn(
                                                            "h-10 rounded-xl border bg-white font-black text-center text-sm w-full focus-visible:ring-blue-500",
                                                            item.factQty === '' ? "border-amber-300 bg-amber-50/10" : "border-slate-200"
                                                        )}
                                                    />
                                                </div>

                                                <div>
                                                    {item.factQty !== '' ? (
                                                        (() => {
                                                            const factNum = Number(String(item.factQty).replace(',', '.'));
                                                            const diff = factNum - item.invoiceQty;
                                                            const hasDiff = diff !== 0;
                                                            return hasDiff ? (
                                                                <div className={cn(
                                                                    "text-xs font-black px-3 py-1 rounded-xl flex items-center gap-1",
                                                                    diff > 0 ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                                                                )}>
                                                                    <AlertTriangle className="w-3.5 h-3.5" />
                                                                    Разница: {diff > 0 ? `+${diff}` : diff}
                                                                </div>
                                                            ) : (
                                                                <div className="text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-xl flex items-center gap-1">
                                                                    <CheckCircle className="w-3.5 h-3.5" /> Свершено
                                                                </div>
                                                            );
                                                        })()
                                                    ) : (
                                                        <div className="text-xs font-bold text-amber-600 bg-amber-50 px-3 py-1 rounded-xl flex items-center gap-1">
                                                            <Clock className="w-3.5 h-3.5" /> Ожидает ввода
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Comment & Submit */}
                    <Card className="rounded-[2rem] shadow-xl border-none overflow-hidden">
                        <CardContent className="p-8 space-y-6">
                            <div className="space-y-2">
                                <Label className="text-xs font-bold uppercase text-slate-400 ml-1">Комментарий к приёмке (Audit)</Label>
                                <Textarea 
                                    value={comment} 
                                    onChange={(e) => setComment(e.target.value)} 
                                    placeholder="Например: Недовоз 2кг картофеля, водитель согласился..." 
                                    className="rounded-2xl border-slate-200"
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
