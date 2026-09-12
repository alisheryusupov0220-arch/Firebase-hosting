'use client';

import { useState, useRef, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { 
    Dialog, 
    DialogContent, 
    DialogHeader, 
    DialogTitle, 
    DialogTrigger,
    DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { UserPlus, Landmark, ScanFace, RefreshCw, Pencil, Calendar, ArrowUpCircle, ArrowDownCircle, Clock, PlusCircle, RotateCw, Banknote, FileText, Eye } from 'lucide-react';
import { createContractorAction, paySupplierAction } from './actions';
import { uploadSupplyImageAction } from '@/app/actions/ai-ocr-actions';
import { Textarea } from '@/components/ui/textarea';
import { BankAccount } from '@/lib/types/finance';
import { scanContractorInvoiceAction } from './ai-ocr-actions';
import { Contractor } from '@/lib/types/finance';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { doc, updateDoc, collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { useFirestore } from '@/firebase/hooks';
import { useFirebase } from '@/firebase/provider';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { getLocalIngredients } from '@/app/ingredients/actions';
import { updateContractorIngredientsAction } from './actions';
import { ShoppingBag, Search as SearchIcon, Tags, X } from 'lucide-react';
import Link from 'next/link';

// ============================================
// 1. ДИАЛОГ ДОБАВЛЕНИЯ КОНТРАГЕНТА (без изменений)
// ============================================
export function AddContractorDialog() {
    const { toast } = useToast();
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [ocrLoading, setOcrLoading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { orgId } = useFirebase();
    const { register, handleSubmit, reset, setValue } = useForm<Partial<Contractor>>();

    async function handleFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0];
        if (!file) return;
        setOcrLoading(true);
        const reader = new FileReader();
        reader.onload = async (e) => {
            const base64 = e.target?.result as string;
            try {
                const result = await scanContractorInvoiceAction(base64);
                if (result.success && result.data) {
                    const d = result.data;
                    if (d.name) setValue('name', d.name);
                    if (d.inn) setValue('inn', d.inn);
                    if (d.bankAccount) setValue('bankAccount', d.bankAccount);
                    if (d.bankCode) setValue('bankCode', d.bankCode);
                    if (d.bankName) setValue('bankName', d.bankName);
                    toast({ title: 'ИИ распознал реквизиты!', description: 'Проверьте данные перед сохранением.' });
                } else {
                    toast({ variant: 'destructive', title: 'Ошибка ИИ', description: 'Не удалось считать данные со скрина.' });
                }
            } catch (err) {
                toast({ variant: 'destructive', title: 'Ошибка сканера', description: 'Что-то пошло не так.' });
            } finally {
                setOcrLoading(false);
                if (fileInputRef.current) fileInputRef.current.value = '';
            }
        };
        reader.readAsDataURL(file);
    }

    async function onSubmit(data: Partial<Contractor>) {
        if (!orgId) {
            toast({ variant: 'destructive', title: 'Ошибка', description: 'Организация не определена' });
            return;
        }
        setLoading(true);
        try {
            const result = await createContractorAction(orgId, data);
            if (result.success) {
                toast({ title: 'Контрагент зарегистрирован' });
                reset();
                setOpen(false);
            } else if (result.error) {
                toast({ variant: 'destructive', title: 'Ошибка реестра', description: result.error });
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="h-14 px-8 rounded-[1.5rem] bg-indigo-600 hover:bg-black font-black uppercase text-[10px] tracking-widest shadow-xl shadow-indigo-100 transition-all hover:scale-[1.02]">
                    <UserPlus className="w-4 h-4 mr-2" /> Добавить Контрагента
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[550px] rounded-[3.5rem] p-12 border-none shadow-2xl overflow-y-auto max-h-[95vh] bg-card dark:bg-slate-900 scrollbar-hide">
                <DialogHeader>
                    <div className="flex justify-between items-start">
                        <DialogTitle className="text-2xl font-black uppercase tracking-tighter flex items-center gap-3">
                            <div className="p-3 bg-indigo-50 rounded-[1.5rem]">
                                <UserPlus className="w-7 h-7 text-indigo-600" />
                            </div>
                            <div className="flex flex-col">
                                <span>Регистрация</span>
                                <span className="text-[10px] text-indigo-400 -mt-1 tracking-[0.2em] font-black uppercase">Treasury Hub</span>
                            </div>
                        </DialogTitle>
                        <div className="flex flex-col items-center">
                            <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" accept="image/*" />
                            <Button type="button" disabled={ocrLoading} onClick={() => fileInputRef.current?.click()}
                                className={cn("h-20 w-32 flex flex-col items-center justify-center rounded-[2rem] gap-2 transition-all p-0 border-2",
                                    ocrLoading ? "bg-amber-50 border-amber-200" : "bg-emerald-50 border-emerald-100 group hover:border-emerald-300")}>
                                {ocrLoading ? <RefreshCw className="h-6 w-6 text-amber-500 animate-spin" /> : <ScanFace className="h-7 w-7 text-emerald-600 group-hover:scale-110 transition-transform" />}
                                <span className={cn("text-[8px] font-black uppercase tracking-widest", ocrLoading ? "text-amber-600" : "text-emerald-700")}>
                                    {ocrLoading ? 'Думаю...' : 'Скан (ИИ)'}
                                </span>
                            </Button>
                        </div>
                    </div>
                </DialogHeader>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-8 pt-6">
                    <div className="grid gap-6">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-[10px] uppercase font-black ml-1 text-slate-400 tracking-widest">Юр. Название (ООО/ИП)</Label>
                                <Input {...register('name', { required: true })} placeholder="ООО Название" className="h-14 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border-none shadow-inner font-black text-xs uppercase pl-4" />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] uppercase font-black ml-1 text-slate-400 tracking-widest">Имя для Сотрудников (Alias)</Label>
                                <Input {...register('alias')} placeholder="Напр: Картошка Фри" className="h-14 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border-none shadow-inner font-black text-xs uppercase pl-4" />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-[10px] uppercase font-black ml-1 text-slate-400">ИНН (Налоговый ID)</Label>
                                <Input {...register('inn')} placeholder="9 или 10 цифр" className="h-14 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border-none shadow-inner font-black pl-4" />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] uppercase font-black ml-1 text-slate-400">Контакт</Label>
                                <Input {...register('phone')} placeholder="+998" className="h-14 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border-none shadow-inner font-black pl-4" />
                            </div>
                        </div>

                        <div className="flex items-center justify-between p-4 bg-amber-50 rounded-2xl border border-amber-100/50">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-amber-100 rounded-xl">
                                    <Banknote className="w-5 h-5 text-amber-600" />
                                </div>
                                <div>
                                    <p className="text-xs font-black uppercase tracking-tight">Расчет Наличными</p>
                                    <p className="text-[9px] font-bold text-amber-700/60 leading-none">Разрешить оплату по кэшу?</p>
                                </div>
                            </div>
                            <Switch 
                                onCheckedChange={(checked) => setValue('allowCash', checked)} 
                                defaultChecked={true}
                            />
                        </div>

                        <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-slate-200 rounded-xl">
                                    <Eye className="w-5 h-5 text-slate-600" />
                                </div>
                                <div>
                                    <p className="text-xs font-black uppercase tracking-tight">Скрыть от сотрудников</p>
                                    <p className="text-[9px] font-bold text-slate-500 leading-none">Не показывать на планшете приемки</p>
                                </div>
                            </div>
                            <Switch 
                                onCheckedChange={(checked) => setValue('isHiddenForStaff', checked)} 
                                defaultChecked={false}
                            />
                        </div>
                    </div>
                    <div className="p-8 bg-slate-50 dark:bg-slate-800/50 rounded-[3rem] border-2 border-white shadow-[0_15px_30px_-5px_rgba(0,0,0,0.03)] space-y-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-indigo-100 rounded-xl"><Landmark className="h-4 w-4 text-indigo-600" /></div>
                            <Label className="text-[11px] uppercase font-black text-indigo-600 tracking-[0.2em]">Банковская логистика</Label>
                        </div>
                        <div className="grid gap-4">
                            <div className="space-y-1.5 px-1">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Расчетный счет (20 цифр)</p>
                                <Input {...register('bankAccount')} placeholder="20208..." className="h-12 rounded-xl bg-card dark:bg-slate-900 border-2 border-slate-100 shadow-sm font-mono text-sm font-black p-4" />
                            </div>
                            <div className="grid grid-cols-2 gap-3 px-1">
                                <div className="space-y-1.5 flex-1">
                                    <p className="text-[9px] font-black text-slate-400 uppercase ml-1">МФО Банка</p>
                                    <Input {...register('bankCode')} placeholder="01018" className="h-12 rounded-xl bg-card dark:bg-slate-900 border-2 border-slate-100 shadow-sm font-black text-xs p-4" />
                                </div>
                                <div className="space-y-1.5 flex-1">
                                    <p className="text-[9px] font-black text-slate-400 uppercase ml-1">Имя Банка</p>
                                    <Input {...register('bankName')} placeholder="Капиталбанк" className="h-12 rounded-xl bg-card dark:bg-slate-900 border-2 border-slate-100 shadow-sm font-black text-xs p-4" />
                                </div>
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="submit" disabled={loading || ocrLoading} className="w-full h-20 rounded-[2rem] bg-indigo-600 hover:bg-black font-black uppercase text-[13px] tracking-[0.3em] shadow-2xl transition-all active:scale-95">
                            {loading ? <RefreshCw className="h-5 w-5 animate-spin" /> : 'Зафиксировать в Реестре'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

// ============================================
// 2. ДИАЛОГ РЕДАКТИРОВАНИЯ КОНТРАГЕНТА (НОВЫЙ)
// ============================================
export function EditContractorDialog({ contractor }: { contractor: Contractor }) {
    const { toast } = useToast();
    const firestore = useFirestore();
    const { orgId } = useFirebase();
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const { register, handleSubmit, reset, setValue } = useForm<Partial<Contractor>>({
        defaultValues: {
            ...contractor,
            allowCash: contractor.allowCash ?? true
        }
    });

    useEffect(() => {
        if (open) reset(contractor);
    }, [open, contractor]);

    async function onSubmit(data: Partial<Contractor>) {
        if (!firestore || !orgId) return;
        setLoading(true);
        try {
            await updateDoc(doc(firestore, 'organizations', orgId, 'contractors', contractor.id), {
                name: (data.name || '').toUpperCase(),
                alias: data.alias || '',
                inn: data.inn || '',
                phone: data.phone || '',
                bankAccount: (data.bankAccount || '').replace(/\s/g, ''),
                bankCode: data.bankCode || '',
                bankName: data.bankName || '',
                allowCash: data.allowCash ?? true,
                isHiddenForStaff: data.isHiddenForStaff ?? false
            });
            toast({ title: 'Данные контрагента обновлены' });
            setOpen(false);
        } catch (e) {
            toast({ variant: 'destructive', title: 'Ошибка сохранения' });
        } finally {
            setLoading(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-xl h-8 w-8 hover:bg-indigo-50 hover:text-indigo-600">
                    <Pencil className="w-4 h-4" />
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px] rounded-[3.5rem] p-12 border-none shadow-2xl overflow-y-auto max-h-[95vh] bg-card dark:bg-slate-900 scrollbar-hide">
                <DialogHeader>
                    <DialogTitle className="text-2xl font-black uppercase tracking-tighter flex items-center gap-3 mb-2">
                        <div className="p-3 bg-slate-100 rounded-[1.5rem]">
                            <Pencil className="w-6 h-6 text-slate-600" />
                        </div>
                        <div>
                            <div>Редактирование</div>
                            <div className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em]">{contractor.name}</div>
                        </div>
                    </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 pt-4">
                    <div className="grid gap-5">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-[10px] uppercase font-black text-slate-400 tracking-widest ml-1">Наименование</Label>
                                <Input {...register('name')} className="h-14 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border-none shadow-inner font-black uppercase" />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] uppercase font-black text-slate-400 tracking-widest ml-1">Alias (Для Сотрудников)</Label>
                                <Input {...register('alias')} className="h-14 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border-none shadow-inner font-black uppercase" />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-[10px] uppercase font-black text-slate-400 ml-1">ИНН</Label>
                                <Input {...register('inn')} className="h-12 rounded-xl bg-slate-50 dark:bg-slate-800/50 border-none shadow-inner font-mono font-black" />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] uppercase font-black text-slate-400 ml-1">Телефон</Label>
                                <Input {...register('phone')} className="h-12 rounded-xl bg-slate-50 dark:bg-slate-800/50 border-none shadow-inner font-black" />
                            </div>
                        </div>

                        <div className="flex items-center justify-between p-6 bg-amber-50/50 rounded-[2rem] border-2 border-amber-100/30">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-amber-100 rounded-xl">
                                    <Banknote className="w-5 h-5 text-amber-600" />
                                </div>
                                <div>
                                    <p className="text-xs font-black uppercase tracking-tight">Расчет Наличными</p>
                                    <p className="text-[9px] font-bold text-amber-700/60 leading-none">Разрешить оплату по кэшу?</p>
                                </div>
                            </div>
                            <Switch 
                                onCheckedChange={(checked) => setValue('allowCash', checked)} 
                                defaultChecked={contractor.allowCash ?? true}
                            />
                        </div>

                        <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-slate-200 rounded-xl">
                                    <Eye className="w-5 h-5 text-slate-600" />
                                </div>
                                <div>
                                    <p className="text-xs font-black uppercase tracking-tight">Скрыть от сотрудников</p>
                                    <p className="text-[9px] font-bold text-slate-500 leading-none">Не показывать на планшете приемки</p>
                                </div>
                            </div>
                            <Switch 
                                onCheckedChange={(checked) => setValue('isHiddenForStaff', checked)} 
                                defaultChecked={contractor.isHiddenForStaff ?? false}
                            />
                        </div>

                        <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-[2rem] space-y-4 border-2 border-white">
                            <div className="flex items-center gap-2">
                                <Landmark className="h-4 w-4 text-indigo-500" />
                                <span className="text-[10px] font-black uppercase text-indigo-600 tracking-widest">Банковские реквизиты</span>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[9px] uppercase font-black text-slate-400 ml-1">Расчетный счет</Label>
                                <Input {...register('bankAccount')} className="h-12 rounded-xl bg-card dark:bg-slate-900 border-2 border-slate-100 font-mono font-black" />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-2">
                                    <Label className="text-[9px] uppercase font-black text-slate-400 ml-1">МФО</Label>
                                    <Input {...register('bankCode')} className="h-10 rounded-xl bg-card dark:bg-slate-900 border-2 border-slate-100 font-mono font-black" />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[9px] uppercase font-black text-slate-400 ml-1">Банк</Label>
                                    <Input {...register('bankName')} className="h-10 rounded-xl bg-card dark:bg-slate-900 border-2 border-slate-100 font-black text-xs" />
                                </div>
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="submit" disabled={loading} className="w-full h-16 rounded-[2rem] bg-primary hover:bg-black font-black uppercase text-[12px] tracking-widest shadow-xl transition-all">
                            {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : 'Сохранить изменения'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

// ============================================
// 3. ДИАЛОГ ИСТОРИИ ОПЕРАЦИЙ КОНТРАГЕНТА (НОВЫЙ)
// ============================================
export function ContractorHistoryDialog({ contractor }: { contractor: Contractor }) {
    const { orgId } = useFirebase();
    const firestore = useFirestore();
    const [open, setOpen] = useState(false);
    const [transactions, setTransactions] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!open || !firestore || !orgId) return;
        setLoading(true);

        const fetchHistory = async () => {
            try {
                // 1. Получаем финансовые транзакции
                const txQuery = query(
                    collection(firestore, 'organizations', orgId, 'finance_transactions'),
                    orderBy('createdAt', 'desc')
                );
                const txSnap = await getDocs(txQuery);
                const allTx = txSnap.docs.map(d => {
                    const data = d.data() as any;
                    const dateVal = data.date || data.createdAt?.toDate?.() || data.createdAt;
                    return { id: d.id, ...data, isInvoice: false, displayDate: dateVal };
                });
                
                // Фильтруем транзакции по ИНН, имени или ID
                const filteredTx = allTx.filter(t => 
                    (t.contractorId === contractor.id) ||
                    (contractor.inn && t.counterpartyInn === contractor.inn) ||
                    (t.counterparty?.toLowerCase().includes(contractor.name?.toLowerCase()))
                );

                // 2. Получаем накладные (accounts_payable)
                const apQuery = query(
                    collection(firestore, 'organizations', orgId, 'accounts_payable'),
                    where('supplierId', '==', contractor.id)
                );
                const apSnap = await getDocs(apQuery);
                const apItems = apSnap.docs.map(d => {
                    const data = d.data() as any;
                    const dateVal = data.createdAt?.toDate?.() || data.createdAt;
                    return {
                        id: d.id,
                        isInvoice: true,
                        type: 'invoice',
                        orderId: data.orderId || d.id,
                        posterSupplyId: data.posterSupplyId || '',
                        amount: data.totalAmount || 0,
                        comment: `Поставка товаров (Накладная №${(data.orderId || d.id).slice(-6).toUpperCase()})`,
                        currency: 'UZS',
                        displayDate: dateVal
                    };
                });

                // 3. Объединяем и сортируем по дате
                const merged = [...filteredTx, ...apItems].sort((a, b) => {
                    const dateA = a.displayDate ? new Date(a.displayDate).getTime() : 0;
                    const dateB = b.displayDate ? new Date(b.displayDate).getTime() : 0;
                    return dateB - dateA;
                });

                setTransactions(merged);
            } catch (e) {
                console.error("History fetch error:", e);
                setTransactions([]);
            } finally {
                setLoading(false);
            }
        };
        fetchHistory();
    }, [open, firestore, contractor]);

    const totalExpense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + (t.amount || 0), 0);
    const totalIncome = transactions.filter(t => t.type === 'income').reduce((s, t) => s + (t.amount || 0), 0);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="rounded-2xl h-10 px-6 font-black uppercase text-[9px] tracking-widest bg-primary hover:bg-black shadow-lg shadow-primary/20">
                    История <Calendar className="ml-2 h-3 w-3" />
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[560px] rounded-[3.5rem] p-0 border-none shadow-2xl overflow-hidden bg-card dark:bg-slate-900 max-h-[90vh] flex flex-col">
                <DialogTitle className="sr-only">История операций</DialogTitle>
                {/* HEADER */}
                <div className="bg-primary p-10 pb-8 flex-shrink-0">
                    <div className="flex items-center gap-4 mb-6">
                        <div className="p-3 bg-card dark:bg-slate-900/20 rounded-[1.5rem]">
                            <Calendar className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-primary-foreground/60">История операций</p>
                            <h2 className="text-xl font-black uppercase tracking-tighter text-white leading-none">{contractor.name}</h2>
                        </div>
                    </div>
                    {/* ИТОГИ */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-card dark:bg-slate-900/10 backdrop-blur p-5 rounded-[2rem]">
                            <p className="text-[9px] font-black uppercase text-white/60 tracking-widest mb-1">Расход (нам)</p>
                            <p className="text-2xl font-black text-white">{totalExpense.toLocaleString()} <span className="text-xs text-white/60">сум</span></p>
                        </div>
                        <div className="bg-card dark:bg-slate-900/10 backdrop-blur p-5 rounded-[2rem]">
                            <p className="text-[9px] font-black uppercase text-white/60 tracking-widest mb-1">Приход (от них)</p>
                            <p className="text-2xl font-black text-emerald-300">{totalIncome.toLocaleString()} <span className="text-xs text-white/40">сум</span></p>
                        </div>
                    </div>
                </div>

                {/* СПИСОК */}
                <div className="flex-1 overflow-y-auto p-8 space-y-4 scrollbar-hide">
                    {loading && (
                        <div className="flex justify-center py-20">
                            <RefreshCw className="h-8 w-8 text-muted-foreground animate-spin" />
                        </div>
                    )}
                    {!loading && transactions.length === 0 && (
                        <div className="text-center py-20 space-y-3">
                            <Clock className="h-12 w-12 text-muted-foreground/20 mx-auto" />
                            <p className="text-sm font-black uppercase text-muted-foreground/40 tracking-widest">История пока пуста</p>
                        </div>
                    )}
                    {!loading && transactions.map(t => {
                        const isInv = t.isInvoice;
                        const dateObj = t.displayDate ? (t.displayDate.toDate ? t.displayDate.toDate() : new Date(t.displayDate)) : null;
                        
                        return (
                            <div key={t.id} className="flex items-center gap-4 p-5 bg-slate-50 dark:bg-slate-800/50 rounded-[2rem] hover:bg-slate-100 transition-colors relative group/item">
                                <div className={cn(
                                    "p-3 rounded-[1.2rem]", 
                                    isInv 
                                        ? "bg-blue-100" 
                                        : t.type === 'income' 
                                            ? "bg-emerald-100" 
                                            : "bg-rose-100"
                                )}>
                                    {isInv 
                                        ? <FileText className="h-5 w-5 text-blue-600" />
                                        : t.type === 'income' 
                                            ? <ArrowDownCircle className="h-5 w-5 text-emerald-600" />
                                            : <ArrowUpCircle className="h-5 w-5 text-rose-600" />
                                    }
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-black uppercase tracking-tight truncate">{t.comment || t.metadata?.docType || 'Операция'}</p>
                                    <p className="text-[10px] text-muted-foreground font-medium">
                                        {dateObj ? format(dateObj, 'd MMMM yyyy HH:mm', { locale: ru }) : '—'}
                                    </p>
                                </div>
                                <div className="text-right flex items-center gap-3">
                                    <div>
                                        <p className={cn(
                                            "text-base font-black", 
                                            isInv 
                                                ? "text-blue-600" 
                                                : t.type === 'income' 
                                                    ? "text-emerald-600" 
                                                    : "text-rose-600"
                                        )}>
                                            {isInv ? '+' : t.type === 'income' ? '+' : '-'}{(t.amount || 0).toLocaleString()}
                                        </p>
                                        <p className="text-[9px] text-muted-foreground">
                                            {isInv ? 'Начисление долга' : t.currency || 'UZS'}
                                        </p>
                                    </div>
                                    {isInv && (
                                        <Link href={`/orders/${t.orderId}`} target="_blank">
                                            <Button 
                                                size="icon" 
                                                variant="ghost" 
                                                className="rounded-xl h-8 w-8 text-blue-600 hover:bg-blue-50"
                                                title="Посмотреть накладную и факт приемки"
                                            >
                                                <Eye className="w-4 h-4" />
                                            </Button>
                                        </Link>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </DialogContent>
        </Dialog>
    );
}

// ============================================
// 4. ДИАЛОГ ПРИВЯЗКИ ИНГРЕДИЕНТОВ (ГЛОБАЛЬНАЯ ЛОГИКА)
// ============================================
export function ContractorIngredientsDialog({ contractor }: { contractor: Contractor }) {
    const { orgId } = useFirebase();
    const { toast } = useToast();
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [ingredients, setIngredients] = useState<any[]>([]); // Все из Poster
    const [priceList, setPriceList] = useState<any[]>(contractor.priceList || []); 
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        if (!open) return;
        const load = async () => {
            const data = await getLocalIngredients(orgId || '');
            setIngredients(data);
        };
        load();
        setPriceList(contractor.priceList || []);
    }, [open, contractor]);

    const handleAddItem = (ing: any) => {
        if (priceList.find(p => p.id === ing.id)) return;
        setPriceList([...priceList, {
            id: ing.id,
            name: ing.name,
            unit: ing.unit,
            price: 0
        }]);
    };

    const handleRemoveItem = (id: string) => {
        setPriceList(priceList.filter(p => p.id !== id));
    };

    const handleUpdatePrice = (id: string, price: number) => {
        setPriceList(priceList.map(p => p.id === id ? { ...p, price } : p));
    };

    const handleSave = async () => {
        if (!orgId) {
            toast({ variant: 'destructive', title: 'Ошибка', description: 'Организация не определена' });
            return;
        }
        setLoading(true);
        try {
            const result = await updateContractorIngredientsAction(orgId, contractor.id, priceList);
            if (result.success) {
                toast({ title: 'Прайс-лист обновлен' });
                setOpen(false);
            }
        } catch (e) {
            toast({ variant: 'destructive', title: 'Ошибка сохранения' });
        } finally {
            setLoading(false);
        }
    };

    const filtered = ingredients.filter(ing => 
        ing.name.toLowerCase().includes(searchTerm.toLowerCase())
    ).slice(0, 5);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="rounded-2xl h-10 px-4 font-black uppercase text-[9px] tracking-widest bg-pink-50 text-pink-600 hover:bg-pink-100 hover:text-pink-700 transition-colors gap-2">
                    Ингредиенты <ShoppingBag className="h-3.5 w-3.5" />
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[700px] rounded-[3.5rem] p-0 border-none shadow-2xl overflow-hidden bg-card dark:bg-slate-900 max-h-[90vh] flex flex-col">
                <DialogTitle className="sr-only">Ингредиенты поставщика</DialogTitle>
                
                {/* HEADER */}
                <div className="bg-pink-600 p-10 pb-8 flex-shrink-0">
                    <div className="flex items-center gap-4 mb-6">
                        <div className="p-3 bg-card dark:bg-slate-900/20 rounded-[1.5rem]">
                            <ShoppingBag className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-pink-100">Ингредиенты Контрагента</p>
                            <h2 className="text-xl font-black uppercase tracking-tighter text-white leading-none">{contractor.name}</h2>
                        </div>
                    </div>
                    
                    {/* ПОИСК ИЗ ПОСТЕРА */}
                    <div className="relative">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-pink-300">
                            <SearchIcon className="h-4 w-4" />
                        </div>
                        <Input 
                            placeholder="Найти в справочнике Poster..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="h-14 rounded-2xl bg-card dark:bg-slate-900/10 border-none text-white placeholder:text-pink-200 pl-11 font-bold text-sm"
                        />
                        {searchTerm && (
                            <div className="absolute top-16 left-0 right-0 bg-card dark:bg-slate-900 rounded-2xl shadow-2xl z-50 p-3 space-y-1">
                                {filtered.length === 0 && <p className="text-[10px] uppercase font-black text-slate-400 p-3">Ничего не найдено</p>}
                                {filtered.map(ing => (
                                    <div key={ing.id} onClick={() => { handleAddItem(ing); setSearchTerm(''); }}
                                        className="flex items-center justify-between p-3 hover:bg-pink-50 rounded-xl cursor-pointer transition-colors group">
                                        <div>
                                            <p className="text-xs font-black uppercase text-slate-700 group-hover:text-pink-600">{ing.name}</p>
                                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{ing.unit}</p>
                                        </div>
                                        <PlusCircle className="h-4 w-4 text-slate-300 group-hover:text-pink-600" />
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* СПИСОК ПРИВЯЗАННЫХ */}
                <div className="flex-1 overflow-y-auto p-8 pt-6 space-y-4 scrollbar-hide bg-slate-50 dark:bg-slate-800/50">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">Привязанные позиции ({priceList.length})</h3>
                    </div>
                    
                    {priceList.length === 0 && (
                        <div className="text-center py-16 bg-card dark:bg-slate-900 rounded-[2rem] border-2 border-dashed border-slate-200">
                            <Tags className="h-12 w-12 text-slate-200 mx-auto mb-3" />
                            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Прайс-лист пока пуст</p>
                        </div>
                    )}

                    <div className="grid gap-3">
                        {priceList.map(item => (
                            <div key={item.id} className="bg-card dark:bg-slate-900 p-5 rounded-[2rem] shadow-sm flex items-center gap-4 group hover:shadow-md transition-all">
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-black uppercase truncate">{item.name}</p>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{item.unit}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Input 
                                        type="number"
                                        placeholder="Цена"
                                        value={item.price || ''}
                                        onChange={(e) => handleUpdatePrice(item.id, Number(e.target.value))}
                                        className="h-10 w-24 rounded-xl font-black text-sm text-right pr-3"
                                    />
                                    <Button variant="ghost" size="icon" onClick={() => handleRemoveItem(item.id)}
                                        className="rounded-xl hover:bg-rose-50 hover:text-rose-600 text-slate-300">
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* FOOTER */}
                <div className="p-8 bg-card dark:bg-slate-900 border-t flex-shrink-0">
                    <Button disabled={loading} onClick={handleSave}
                        className="w-full h-16 rounded-[2rem] bg-pink-600 hover:bg-black font-black uppercase text-xs tracking-[0.2em] shadow-xl transition-all active:scale-95">
                        {loading ? <RotateCw className="h-5 w-5 animate-spin" /> : 'Зафиксировать прайс-лист'}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

// =====================================================
// 5. ДИАЛО�3 ОПЛАТЫ
// =======================================================

export function PaySupplierDialog({ contractor, accounts }: { contractor: Contractor, accounts: BankAccount[] }) {
    const { toast } = useToast();
    const { orgId } = useFirebase();
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [amount, setAmount] = useState('');
    const [comment, setComment] = useState('');
    const [accountId, setAccountId] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [photoUrl, setPhotoUrl] = useState('');

    async function handleFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0];
        if (!file || !orgId) return;
        setLoading(true);
        const reader = new FileReader();
        reader.onload = async (e) => {
            const base64Str = (e.target?.result as string).split(',')[1];
            try {
                const result = await uploadSupplyImageAction(base64Str, `payment_${orgId}_${Date.now()}.jpg`, 'image/jpeg');
                if (result.url) setPhotoUrl(result.url);
            } catch (err) {
                toast({ variant: 'destructive', title: 'Ошибка загрузки фото' });
            } finally {
                setLoading(false);
            }
        };
        reader.readAsDataURL(file);
    }

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!orgId) return;
        setLoading(true);
        try {
            const res = await paySupplierAction(orgId, {
                contractorId: contractor.id,
                amount: Number(amount),
                comment,
                photoUrl,
                myAccountId: accountId || undefined
            });
            if (res.success) {
                toast({ title: 'Оплата проведена', description: 'Долг контрагента уменьшен' });
                setOpen(false);
                setAmount('');
                setComment('');
                setPhotoUrl('');
                setAccountId('');
            } else {
                toast({ variant: 'destructive', title: 'Ошибка', description: res.error });
            }
        } catch (err) {
            toast({ variant: 'destructive', title: 'Ошибка сети' });
        } finally {
            setLoading(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button size="sm" className="h-8 rounded-xl bg-emerald-100 hover:bg-emerald-200 text-emerald-700 font-bold text-[10px] uppercase tracking-wider px-4">
                    <Banknote className="w-3.5 h-3.5 mr-1.5" /> Оплатить
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[450px] rounded-[3rem] p-8 border-none shadow-2xl">
                <DialogHeader>
                    <DialogTitle className="text-xl font-black uppercase tracking-tighter flex items-center gap-2">
                        <div className="p-2 bg-emerald-100 rounded-xl">
                            <Banknote className="w-5 h-5 text-emerald-600" />
                        </div>
                        Оплата: {contractor.name}
                    </DialogTitle>
                </DialogHeader>
                <form onSubmit={onSubmit} className="space-y-6 pt-4">
                    <div className="space-y-2">
                        <Label className="text-[10px] uppercase font-black text-slate-400 ml-1">Сумма Оплаты (UZS)</Label>
                        <Input required type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="h-14 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border-none font-black text-lg pl-4" placeholder="0" />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-[10px] uppercase font-black text-slate-400 ml-1">Счет списания</Label>
                        <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className="w-full h-14 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border-none font-bold text-sm px-4 outline-none">
                            <option value="">Внешний (не учитывать на наших счетах)</option>
                            {accounts.map(acc => (
                                <option key={acc.id} value={acc.id}>{acc.bankName} - {acc.accountNumber}</option>
                            ))}
                        </select>
                    </div>
                    <div className="space-y-2">
                        <Label className="text-[10px] uppercase font-black text-slate-400 ml-1">Комментарий</Label>
                        <Textarea value={comment} onChange={(e) => setComment(e.target.value)} className="rounded-2xl bg-slate-50 dark:bg-slate-800/50 border-none font-medium resize-none p-4" placeholder="За что оплата?" />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-[10px] uppercase font-black text-slate-400 ml-1">Скан / Фото перевода (обязательно)</Label>
                        {photoUrl ? (
                            <div className="relative w-full h-32 rounded-2xl overflow-hidden group">
                                <img src={photoUrl} alt="Receipt" className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <Button type="button" variant="destructive" size="sm" onClick={() => setPhotoUrl('')} className="rounded-xl">
                                        <X className="w-4 h-4 mr-2" /> Удалить
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <>
                                <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" accept="image/*" />
                                <Button type="button" disabled={loading} onClick={() => fileInputRef.current?.click()} className="w-full h-14 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold border-2 border-dashed border-slate-300">
                                    <ScanFace className="w-5 h-5 mr-2" /> Загрузить скриншот
                                </Button>
                            </>
                        )}
                    </div>
                    <DialogFooter>
                        <Button type="submit" disabled={loading || !amount || !photoUrl} className="w-full h-16 rounded-[3rem] bg-emerald-600 hover:bg-black font-black uppercase text-xs tracking-widest shadow-xl transition-all active:scale-95">
                            {loading ? <RefreshCw className="h-5 w-5 animate-spin" /> : 'Подтвердить перевод'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
