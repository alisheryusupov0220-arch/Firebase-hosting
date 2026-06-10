'use client';

import { useState } from 'react';
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
import { PlusCircle, Building2, Landmark, Wallet, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useFirebase } from '@/firebase/provider';
import { createMyCompanyAction } from './actions';
import { MyCompany } from '@/lib/types/finance';

export function AddCompanyDialog() {
    const { orgId } = useFirebase();
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const { register, handleSubmit, reset } = useForm<Omit<MyCompany, 'id'>>();

    async function onSubmit(data: Omit<MyCompany, 'id'>) {
        if (!orgId) return;
        setLoading(true);
        try {
            await createMyCompanyAction(orgId, data);
            reset();
            setOpen(false);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" className="gap-2">
                    <PlusCircle className="w-4 h-4" /> Добавить Фирму
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Building2 className="w-5 h-5 text-blue-600" />
                        Регистрация новой фирмы (Юрлица)
                    </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label>Бренд (Маркетинговое название)</Label>
                        <Input {...register('brandName', { required: true })} placeholder="Напр: FLOW" />
                    </div>
                    <div className="space-y-2">
                        <Label>Официальное название (Юрлицо)</Label>
                        <Input {...register('legalName', { required: true })} placeholder="Напр: OOO FLOW-FOOD" />
                    </div>
                    <div className="space-y-2">
                        <Label>ИНН фирмы</Label>
                        <Input {...register('inn', { required: true })} placeholder="12345678" />
                    </div>
                    <DialogFooter>
                        <Button type="submit" disabled={loading} className="w-full">
                            Сохранить Фирму
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

// ---------------------------

export function AddAccountDialog({ companies }: { companies: MyCompany[] }) {
    const { toast } = useToast();
    const { orgId } = useFirebase();
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [type, setType] = useState<'BANK' | 'CASH'>('BANK');
    const { register, handleSubmit, reset, setValue } = useForm<any>();

    async function onSubmit(data: any) {
        if (!orgId) {
            toast({ variant: 'destructive', title: 'Ошибка', description: 'Организация не найдена' });
            return;
        }
        if (!data.companyId) {
            toast({ variant: 'destructive', title: 'Ошибка', description: 'Выберите организацию' });
            return;
        }
        
        setLoading(true);
        try {
            const payload = {
                ...data,
                type,
                accountNumber: type === 'CASH' ? `CASH-${Date.now()}` : data.accountNumber
            };
            const res = await createBankAccountAction(orgId, payload);
            if (res.success) {
                toast({ title: 'Успешно!', description: type === 'BANK' ? 'Счёт открыт' : 'Касса создана' });
                reset();
                setOpen(false);
            } else {
                toast({ variant: 'destructive', title: 'Ошибка', description: res.error });
            }
        } catch (error) {
            console.error(error);
            toast({ variant: 'destructive', title: 'Ошибка', description: 'Не удалось сохранить данные' });
        } finally {
            setLoading(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="bg-blue-600 hover:bg-blue-700 font-bold gap-2">
                    <PlusCircle className="w-4 h-4" /> Новый Счёт
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px] rounded-[2rem] border-none shadow-2xl p-0 overflow-hidden">
                <DialogHeader className="p-8 bg-slate-50 border-b">
                    <DialogTitle className="text-2xl font-black uppercase tracking-tighter">
                        {type === 'BANK' ? 'Открыть банковский счёт' : 'Завести кассу (Наличные)'}
                    </DialogTitle>
                </DialogHeader>
                
                <div className="p-8 space-y-6">
                    <div className="flex bg-slate-100 p-1 rounded-2xl">
                        <Button 
                            type="button"
                            onClick={() => setType('BANK')}
                            className={cn("flex-1 rounded-xl h-12 font-black text-[10px] uppercase shadow-none", type === 'BANK' ? "bg-white text-black shadow-lg" : "bg-transparent text-slate-400 hover:text-slate-600")}
                        >
                            <Landmark className={cn("w-4 h-4 mr-2", type === 'BANK' ? "text-blue-600" : "")} /> Банковский Счёт
                        </Button>
                        <Button 
                            type="button"
                            onClick={() => setType('CASH')}
                            className={cn("flex-1 rounded-xl h-12 font-black text-[10px] uppercase shadow-none", type === 'CASH' ? "bg-white text-black shadow-lg" : "bg-transparent text-slate-400 hover:text-slate-600")}
                        >
                            <Wallet className={cn("w-4 h-4 mr-2", type === 'CASH' ? "text-emerald-600" : "")} /> Наличные (Касса)
                        </Button>
                    </div>

                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">Организация (Владелец)</Label>
                            <Select onValueChange={(v) => setValue('companyId', v)}>
                                <SelectTrigger className="h-14 rounded-2xl bg-slate-50 border-none font-bold text-slate-700 focus:ring-2 focus:ring-primary/20 transition-all">
                                    <SelectValue placeholder="Выберите фирму" />
                                </SelectTrigger>
                                <SelectContent className="rounded-2xl border-none shadow-xl">
                                    {companies.map(c => (
                                        <SelectItem key={c.id} value={c.id} className="rounded-xl">{c.brandName} ({c.legalName})</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-4">
                            {type === 'BANK' ? (
                                <>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">Название Банка</Label>
                                        <Input {...register('bankName', { required: true })} placeholder="Tenge Bank / Asaka" className="h-14 rounded-2xl bg-slate-50 border-none font-bold focus:ring-2 focus:ring-primary/20 transition-all" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">Номер счета (20 цифр)</Label>
                                        <Input {...register('accountNumber', { required: true })} placeholder="2021..." className="h-14 rounded-2xl bg-slate-50 border-none font-mono font-bold focus:ring-2 focus:ring-primary/20 transition-all" />
                                    </div>
                                </>
                            ) : (
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">Название источника</Label>
                                    <Input {...register('bankName', { required: true })} placeholder="Напр: Сейф / Касса (Рынок)" className="h-14 rounded-2xl bg-slate-50 border-none font-bold focus:ring-2 focus:ring-emerald-500/20 transition-all" />
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">Валюта</Label>
                                <Input {...register('currency')} defaultValue="UZS" className="h-14 rounded-2xl bg-slate-50 border-none font-black text-center focus:ring-2 focus:ring-primary/20 transition-all" />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">Нач. остаток</Label>
                                <Input {...register('balance')} type="number" defaultValue="0" className="h-14 rounded-2xl bg-slate-50 border-none font-black text-blue-600 text-center focus:ring-2 focus:ring-primary/20 transition-all" />
                            </div>
                        </div>

                        <Button 
                            type="submit" 
                            disabled={loading} 
                            className={cn(
                                "w-full h-20 rounded-[2rem] font-black uppercase text-xs tracking-[0.2em] shadow-2xl transition-all active:scale-95",
                                type === 'BANK' ? "bg-black text-white hover:bg-slate-800" : "bg-emerald-600 text-white hover:bg-emerald-700"
                            )}
                        >
                            {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : (type === 'BANK' ? 'Открыть банковский счёт' : 'Зафиксировать кассу')}
                        </Button>
                    </form>
                </div>
            </DialogContent>
        </Dialog>
    );
}

import { 
    Select, 
    SelectContent, 
    SelectItem, 
    SelectTrigger, 
    SelectValue 
} from '@/components/ui/select';
import { createBankAccountAction, updateMyCompanyAction } from './actions';
import { Pencil } from 'lucide-react';

export function EditCompanyDialog({ company }: { company: MyCompany }) {
    const { orgId } = useFirebase();
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const { register, handleSubmit } = useForm<Omit<MyCompany, 'id'>>({
        defaultValues: {
            brandName: company.brandName,
            legalName: company.legalName,
            inn: company.inn
        }
    });

    async function onSubmit(data: Omit<MyCompany, 'id'>) {
        if (!orgId) return;
        setLoading(true);
        try {
            await updateMyCompanyAction(orgId, company.id, data);
            setOpen(false);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-xl h-10 w-10 hover:bg-slate-50">
                    <Pencil className="w-5 h-5 text-slate-400" />
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Building2 className="w-5 h-5 text-blue-600" />
                        Редактировать фирму (Юрлицо)
                    </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label>Бренд (Маркетинговое название)</Label>
                        <Input {...register('brandName', { required: true })} placeholder="Напр: FLOW" />
                    </div>
                    <div className="space-y-2">
                        <Label>Официальное название (Юрлицо)</Label>
                        <Input {...register('legalName', { required: true })} placeholder="Напр: OOO FLOW-FOOD" />
                    </div>
                    <div className="space-y-2">
                        <Label>ИНН фирмы</Label>
                        <Input {...register('inn', { required: true })} placeholder="12345678" />
                    </div>
                    <DialogFooter>
                        <Button type="submit" disabled={loading} className="w-full">
                            Сохранить изменения
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
