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
import { 
    Select, 
    SelectContent, 
    SelectItem, 
    SelectTrigger, 
    SelectValue 
} from '@/components/ui/select';
import { PlusCircle, Wallet, ArrowUpCircle, ArrowDownCircle, Landmark, Hash, Info, RotateCw, ExternalLink } from 'lucide-react';
import { createTransactionAction } from './actions';
import { FinanceTransaction, BankAccount, MyCompany } from '@/lib/types/finance';
import { SearchableSelect } from '@/components/ui/searchable-select';
import Link from 'next/link';

interface Contractor {
    id: string;
    name: string;
    inn?: string;
    bankAccount?: string;
    bankName?: string;
    bankCode?: string;
    phone?: string;
    balance?: number;
    allowCash: boolean;
}

export function AddTransactionDialog({ 
    orgId,
    accounts, 
    companies,
    contractors = []
}: { 
    orgId: string;
    accounts: BankAccount[], 
    companies: MyCompany[],
    contractors: Contractor[]
}) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const { register, handleSubmit, reset, setValue, watch } = useForm<Partial<FinanceTransaction>>({
        defaultValues: {
            type: 'expense',
            currency: 'UZS',
            status: 'completed'
        }
    });

    const currentType = watch('type');
    const currentCounterparty = watch('counterparty');

    const contractorOptions = contractors.map(c => ({
        value: c.id,
        label: c.name
    }));

    const handleContractorSelect = (contractorId: string) => {
        const contractor = contractors.find(c => c.id === contractorId);
        if (contractor) {
            // Авто-заполняем все реквизиты из единого реестра
            setValue('contractorId', contractor.id);
            setValue('counterparty', contractor.name);
            setValue('counterpartyInn', contractor.inn || '');
            setValue('counterpartyAccount', contractor.bankAccount || '');
        }
    };

    async function onSubmit(data: Partial<FinanceTransaction>) {
        setLoading(true);
        try {
            await createTransactionAction(orgId, {
                ...data,
                amount: Number(data.amount)
            });
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
                <Button className="rounded-xl shadow-lg bg-indigo-600 hover:bg-indigo-700 h-12 px-6 gap-2 font-bold">
                    <PlusCircle className="w-5 h-5" />
                    Операция Вручную
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] rounded-2xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-xl font-bold">
                        <Wallet className="w-5 h-5 text-indigo-600" />
                        Добавить транзакцию
                    </DialogTitle>
                </DialogHeader>
                
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
                    <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl mb-4">
                        <button
                            type="button"
                            onClick={() => setValue('type', 'expense')}
                            className={`flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-bold transition-all
                                ${currentType === 'expense' ? 'bg-white shadow-sm text-red-600' : 'text-slate-500 hover:bg-white/50'}`}
                        >
                            <ArrowDownCircle className="w-4 h-4" /> Расход
                        </button>
                        <button
                            type="button"
                            onClick={() => setValue('type', 'income')}
                            className={`flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-bold transition-all
                                ${currentType === 'income' ? 'bg-white shadow-sm text-green-600' : 'text-slate-500 hover:bg-white/50'}`}
                        >
                            <ArrowUpCircle className="w-4 h-4" /> Приход
                        </button>
                    </div>

                    <div className="space-y-2">
                        <div className="flex justify-between items-center">
                            <Label>Контрагент (Кому/От кого)</Label>
                            <Link 
                                href="/finance-hub/accounts" 
                                className="text-[10px] text-indigo-600 hover:underline flex items-center gap-1 font-bold uppercase transition-all"
                            >
                                <ExternalLink className="w-3 h-3" /> Реестр контрагентов
                            </Link>
                        </div>
                        <SearchableSelect 
                            options={contractorOptions}
                            placeholder="Выберите из базы или введите имя..."
                            value={contractors.find(c => c.name === currentCounterparty)?.id}
                            onChange={handleContractorSelect}
                        />
                        <p className="text-[10px] text-muted-foreground italic">
                            Если контрагента нет в списке, просто заполните поля ниже вручную.
                        </p>
                    </div>

                    <div className="space-y-4 p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100">
                        <div className="space-y-2">
                            <Label className="text-indigo-600 font-bold flex items-center gap-2">
                                <Landmark className="w-4 h-4" /> Мой Расчетный счет
                            </Label>
                            <Select onValueChange={(val) => {
                                const acc = accounts.find(a => a.id === val);
                                setValue('myAccountId', val);
                                setValue('myCompanyId', acc?.companyId);
                                if (acc?.currency) setValue('currency', acc.currency);
                            }}>
                                <SelectTrigger className="rounded-xl bg-white transition-all">
                                    <SelectValue placeholder="Выберите свой счет" />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl border-none shadow-2xl">
                                    {accounts
                                        .filter(acc => {
                                            const contractor = contractors.find(c => c.name === currentCounterparty);
                                            // Если контрагенту запрещен нал, убираем счета типа CASH
                                            if (contractor && contractor.allowCash === false && acc.type === 'CASH') {
                                                return false;
                                            }
                                            return true;
                                        })
                                        .map(acc => {
                                            const company = companies.find(c => c.id === acc.companyId);
                                            return (
                                                <SelectItem key={acc.id} value={acc.id} className="rounded-lg">
                                                    <div className="flex items-center gap-2">
                                                        {acc.type === 'CASH' ? <Wallet className="w-4 h-4 text-emerald-500" /> : <Landmark className="w-4 h-4 text-blue-500" />}
                                                        <span>{company?.brandName} | {acc.bankName} ({acc.accountNumber.slice(-4)})</span>
                                                    </div>
                                                </SelectItem>
                                            );
                                        })
                                    }
                                </SelectContent>
                            </Select>
                            {/* ПРЕДУПРЕЖДЕНИЕ О ЗАПРЕТЕ НАЛА */}
                            {(() => {
                                const contractor = contractors.find(c => c.name === currentCounterparty);
                                if (contractor && contractor.allowCash === false) {
                                    return (
                                        <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-xl border border-amber-100 mt-1">
                                            <Info className="w-4 h-4 text-amber-600 mt-0.5" />
                                            <p className="text-[10px] text-amber-700 font-bold uppercase leading-tight">
                                                ВНИМАНИЕ: Этому контрагенту запрещен расчет наличными. Доступны только банковские переводы.
                                            </p>
                                        </div>
                                    );
                                }
                                return null;
                            })()}
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                                <Label className="text-xs">Сумма</Label>
                                <Input 
                                    type="number" 
                                    {...register('amount', { required: true })} 
                                    placeholder="0.00" 
                                    className="rounded-xl font-bold bg-white"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs">Валюта</Label>
                                <Select onValueChange={(val) => setValue('currency', val)} defaultValue="UZS">
                                    <SelectTrigger className="rounded-xl bg-white text-xs">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="UZS">UZS</SelectItem>
                                        <SelectItem value="KZT">KZT</SelectItem>
                                        <SelectItem value="USD">USD</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-3 pt-2">
                        <div className="space-y-2 text-indigo-600">
                             <Label className="flex items-center gap-2"><Info className="w-4 h-4"/> Название организации</Label>
                             <Input 
                                {...register('counterparty', { required: true })} 
                                placeholder="Наименование фирмы" 
                                className="rounded-xl border-indigo-100 font-bold"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">ИНН</Label>
                                <Input {...register('counterpartyInn')} placeholder="ИНН" className="h-9 rounded-lg text-xs" />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Код банка</Label>
                                <Input {...register('counterpartyAccount')} placeholder="Счет / МФО" className="h-9 rounded-lg text-xs" />
                            </div>
                        </div>

                        <div className="grid grid-cols-4 gap-3">
                            <div className="col-span-1 space-y-1">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Код</Label>
                                <Input {...register('paymentCode')} placeholder="Напр: 00668" className="h-9 rounded-lg text-xs" />
                            </div>
                            <div className="col-span-3 space-y-1">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Назначение платежа</Label>
                                <Input {...register('paymentPurpose')} placeholder="За что оплата..." className="h-9 rounded-lg text-xs italic" />
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="mt-6">
                        <Button 
                            type="submit" 
                            disabled={loading}
                            className="w-full rounded-xl h-12 bg-indigo-600 font-bold text-lg hover:bg-indigo-700 shadow-indigo-100"
                        >
                            {loading ? <RotateCw className="animate-spin" /> : 'Записать операцию'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

