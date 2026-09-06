'use client';

import React, { useState, useTransition } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
    PlusCircle, 
    Landmark, 
    Users, 
    Search, 
    Pencil, 
    Trash2, 
    AlertCircle,
    Building2,
    Calendar,
    Briefcase,
    Settings2,
    CheckCircle2
} from 'lucide-react';
import { useFirestore, useCollection } from '@/firebase/hooks';
import { useMemoFirebase, useFirebase } from '@/firebase/provider';
import { query, collection, orderBy, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { Contractor, MyCompany, BankAccount } from '@/lib/types/finance';
import { useMemo } from 'react';
import { AddCompanyDialog, AddAccountDialog, EditCompanyDialog } from './account-dialogs';
import { AddContractorDialog, EditContractorDialog, ContractorHistoryDialog, ContractorIngredientsDialog, PaySupplierDialog } from './contractor-dialogs';
import { ScanContractorDialog } from './scan-contractor-dialog';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

export default function TreasuryPage() {
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();
    const firestore = useFirestore();
    const { orgId } = useFirebase();
    const [searchTerm, setSearchTerm] = useState('');

    // Queries
    const companiesQuery = useMemoFirebase(() => 
        (firestore && orgId) ? query(collection(firestore, 'organizations', orgId, 'my_companies'), orderBy('brandName', 'asc')) : null, [firestore, orgId]);
    const accountsQuery = useMemoFirebase(() => 
        (firestore && orgId) ? query(collection(firestore, 'organizations', orgId, 'bank_accounts'), orderBy('bankName', 'asc')) : null, [firestore, orgId]);
    const contractorsQuery = useMemoFirebase(() => 
        (firestore && orgId) ? query(collection(firestore, 'organizations', orgId, 'contractors'), orderBy('name', 'asc')) : null, [firestore, orgId]);

    const { data: companies } = useCollection<MyCompany>(companiesQuery, { once: true });
    const { data: accounts } = useCollection<BankAccount>(accountsQuery, { once: true });
    const { data: contractors } = useCollection<Contractor>(contractorsQuery, { once: true });



    const filteredContractors = (contractors || []).filter(c => 
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        c.inn?.includes(searchTerm)
    );

    const handleDeleteContractor = async (id: string) => {
        if (!firestore || !orgId || !confirm('Удалить контрагента навсегда? Это действие необратимо.')) return;
        try {
            await deleteDoc(doc(firestore, 'organizations', orgId, 'contractors', id));
            toast({ title: 'Контрагент удален', variant: 'destructive' });
        } catch (e) {
            toast({ title: 'Ошибка удаления', variant: 'destructive' });
        }
    };

    const handleDeleteCompany = async (id: string) => {
        if (!firestore || !orgId || !confirm('Удалить эту фирму навсегда? Это действие необратимо.')) return;
        try {
            await deleteDoc(doc(firestore, 'organizations', orgId, 'my_companies', id));
            toast({ title: 'Фирма удалена', variant: 'destructive' });
        } catch (e) {
            toast({ title: 'Ошибка удаления', variant: 'destructive' });
        }
    };

    return (
        <div className="space-y-8 p-4 max-w-7xl mx-auto pb-24">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="space-y-1">
                    <h1 className="text-4xl font-black tracking-tighter uppercase flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-2xl">
                            <Landmark className="w-8 h-8 text-primary" />
                        </div>
                        Казначейство <span className="text-muted-foreground/30 font-thin italic">Treasury</span>
                    </h1>
                    <p className="text-muted-foreground font-medium ml-1">Центральный узел управления контрагентами, фирмами и счетами.</p>
                </div>
                <div className="flex gap-2">
                    <AddCompanyDialog />
                    <AddAccountDialog companies={companies || []} />
                </div>
            </div>

            <Tabs defaultValue="contractors" className="w-full">
                <TabsList className="bg-muted p-1.5 rounded-[2rem] h-14 border shadow-inner mb-8 overflow-x-auto inline-flex whitespace-nowrap">
                    <TabsTrigger value="contractors" className="px-8 rounded-[1.5rem] font-black uppercase text-[10px] tracking-widest flex items-center gap-2">
                        <Users className="w-4 h-4" /> Ингредиенты Контрагенты
                    </TabsTrigger>
                    <TabsTrigger value="accounts" className="px-8 rounded-[1.5rem] font-black uppercase text-[10px] tracking-widest flex items-center gap-2">
                        <Landmark className="w-4 h-4" /> Наши Счета
                    </TabsTrigger>
                    <TabsTrigger value="companies" className="px-8 rounded-[1.5rem] font-black uppercase text-[10px] tracking-widest flex items-center gap-2">
                        <Building2 className="w-4 h-4" /> Наши Фирмы
                    </TabsTrigger>
                </TabsList>

                {/* --- КОНТРАГЕНТЫ (ЕДИНЫЙ РЕЕСТР) --- */}
                <TabsContent value="contractors" className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="flex justify-between items-center gap-4">
                        <div className="relative group max-w-md flex-1">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                            <Input 
                                placeholder="Поиск по имени или ИНН..." 
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-11 h-14 rounded-[1.5rem] bg-card border-2 border-muted transition-all focus:border-primary shadow-xl" 
                            />
                        </div>
                        <div className="flex items-center gap-3">
                            <ScanContractorDialog />
                            <AddContractorDialog />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredContractors.map((c) => (
                            <Card key={c.id} className="rounded-[2.5rem] border-none shadow-2xl bg-card hover:scale-[1.02] transition-all group overflow-hidden">
                                <CardHeader className="pb-4 relative">
                                    <div className="flex justify-between items-start">
                                        <div className="space-y-1">
                                            <CardTitle className="text-xl font-black uppercase leading-tight tracking-tight">
                                                {c.name}
                                            </CardTitle>
                                            <div className="flex gap-2 items-center">
                                                <Badge variant="outline" className={cn(
                                                    "text-[9px] font-black uppercase tracking-tighter px-2 h-5 rounded-lg border-none",
                                                    c.inn ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                                                )}>
                                                    {c.inn ? `ИНН: ${c.inn}` : "ERR: NO INN"}
                                                </Badge>
                                            </div>
                                        </div>
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <EditContractorDialog contractor={c} />
                                            <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                className="rounded-xl h-8 w-8 hover:bg-rose-50 hover:text-rose-600"
                                                onClick={() => handleDeleteContractor(c.id)}
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="grid gap-3">
                                        <div className="bg-muted/30 p-4 rounded-[1.5rem] space-y-2 border border-white">
                                            <p className="text-[8px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-2">
                                                <Landmark className="h-3 w-3" /> Банковские реквизиты
                                            </p>
                                            <p className="text-[10px] font-mono font-bold text-primary truncate">{c.bankAccount || 'Счёт не привязан'}</p>
                                            <div className="flex justify-between items-center">
                                                <span className="text-[9px] font-bold text-muted-foreground">{c.bankName || 'Банк не указан'}</span>
                                                <span className="text-[9px] font-black text-slate-400">КОД: {c.bankCode || '—'}</span>
                                            </div>
                                        </div>
                                        
                                        <div className="flex items-center justify-between px-2 pt-2">
                                            <div className="space-y-0.5">
                                                <p className="text-[7px] font-black uppercase text-muted-foreground leading-none">Общий долг</p>
                                                {(() => {
                                                    const bal = c.balance || 0;
                                                    return (
                                                        <p className={cn(
                                                            "text-lg font-black tracking-tighter",
                                                            bal > 0 ? "text-rose-600" : bal < 0 ? "text-emerald-600" : "text-slate-400"
                                                        )}>
                                                            {bal > 0 ? '+' : ''}{bal.toLocaleString()} <span className="text-[10px]">сум</span>
                                                        </p>
                                                    );
                                                })()}
                                            </div>
                                            <div className="flex gap-2">
                                                <ContractorIngredientsDialog contractor={c} />
                                                <ContractorHistoryDialog contractor={c} />
                                                <PaySupplierDialog contractor={c} accounts={accounts || []} />
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </TabsContent>

                {/* --- НАШИ СЧЕТА --- */}
                <TabsContent value="accounts" className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {accounts?.map((acc) => {
                            const comp = companies?.find(c => c.id === acc.companyId);
                            return (
                                <Card key={acc.id} className="rounded-[2.5rem] border-none shadow-2xl bg-white overflow-hidden group">
                                    <CardHeader className="bg-primary/5 py-6">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <CardTitle className="text-xl font-black uppercase tracking-tight mb-1">{acc.bankName}</CardTitle>
                                                <Badge className="bg-white text-primary border-none shadow-sm font-black text-[9px] uppercase tracking-widest">
                                                    {comp?.brandName || '---'}
                                                </Badge>
                                            </div>
                                            <Landmark className="text-primary/20 w-12 h-12 -mr-2" />
                                        </div>
                                    </CardHeader>
                                    <CardContent className="p-6 space-y-6">
                                        <div className="space-y-1">
                                            <p className="text-[8px] font-black uppercase text-muted-foreground tracking-[0.2em]">Номер Счета</p>
                                            <p className="text-sm font-mono font-bold tracking-widest text-slate-800">{acc.accountNumber}</p>
                                        </div>
                                        <div className="flex justify-between items-end border-t border-slate-50 pt-4">
                                            <div className="space-y-1">
                                                <p className="text-[8px] font-black uppercase text-muted-foreground tracking-[0.2em]">Доступный остаток</p>
                                                <p className="text-2xl font-black tracking-tighter text-slate-900 line-clamp-1">
                                                    {(acc.balance || 0).toLocaleString()} <span className="text-[10px] text-muted-foreground">{acc.currency || 'UZS'}</span>
                                                </p>
                                            </div>
                                            <Button variant="ghost" size="icon" className="rounded-xl h-10 w-10 hover:bg-slate-50">
                                                <Settings2 className="w-5 h-5 text-slate-400" />
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            )
                        })}
                    </div>
                </TabsContent>

                {/* --- НАШИ ФИРМЫ --- */}
                <TabsContent value="companies" className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {companies?.map((comp) => (
                            <Card key={comp.id} className="rounded-[2.5rem] border-none shadow-2xl bg-white overflow-hidden group">
                                <CardHeader className="bg-primary/5 py-6">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <CardTitle className="text-xl font-black uppercase tracking-tight mb-1">{comp.brandName}</CardTitle>
                                            <Badge className="bg-white text-primary border-none shadow-sm font-black text-[9px] uppercase tracking-widest">
                                                Юрлицо
                                            </Badge>
                                        </div>
                                        <Building2 className="text-primary/20 w-12 h-12 -mr-2" />
                                    </div>
                                </CardHeader>
                                <CardContent className="p-6 space-y-6">
                                    <div className="space-y-1">
                                        <p className="text-[8px] font-black uppercase text-muted-foreground tracking-[0.2em]">Официальное название</p>
                                        <p className="text-sm font-bold text-slate-800">{comp.legalName}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[8px] font-black uppercase text-muted-foreground tracking-[0.2em]">ИНН Фирмы</p>
                                        <p className="text-sm font-mono font-bold text-slate-800">{comp.inn}</p>
                                    </div>
                                    <div className="flex justify-between items-end border-t border-slate-50 pt-4">
                                        <div className="flex gap-2 w-full justify-end">
                                            <EditCompanyDialog company={comp} />
                                            <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                className="rounded-xl h-10 w-10 hover:bg-rose-50 hover:text-rose-600"
                                                onClick={() => handleDeleteCompany(comp.id)}
                                            >
                                                <Trash2 className="w-5 h-5" />
                                            </Button>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}
