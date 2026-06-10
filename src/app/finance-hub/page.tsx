'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useFirebase } from '@/firebase/provider';
import { useCollection, useFirestore } from '@/firebase/hooks';
import { useMemoFirebase } from '@/firebase/provider';
import { collection, query, orderBy, where } from 'firebase/firestore';
import { orgCol } from '@/lib/db-paths';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { FinanceSummary } from './finance-summary';
import { AddTransactionDialog } from './add-transaction-dialog';
import { TransactionActionButtons } from './transaction-actions';
import { TransactionDetailsDialog } from './transaction-details-dialog';
import { FinanceTransaction, BankAccount, MyCompany } from '@/lib/types/finance';
import { getBankAccountsAction, getMyCompaniesAction, getContractorsAction } from './accounts/actions';
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import { DialogTrigger } from '@/components/ui/dialog';
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { UserCheck, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export const dynamic = 'force-dynamic';

const PageSkeleton = () => (
    <div className="space-y-6">
        <div className="flex justify-between items-center">
            <Skeleton className="h-10 w-64" />
            <Skeleton className="h-10 w-40" />
        </div>
        <div className="grid grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
        </div>
        <Skeleton className="h-96 rounded-2xl" />
    </div>
);

export default function FinanceHubPage() {
    const { orgId, user, isUserLoading } = useFirebase();
    const firestore = useFirestore();

    const [accounts, setAccounts] = useState<BankAccount[]>([]);
    const [companies, setCompanies] = useState<MyCompany[]>([]);
    const [contractors, setContractors] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // Real-time transactions via Firestore listener
    const txQuery = useMemoFirebase(() => {
        if (!firestore || !orgId) return null;
        return query(
            collection(firestore, orgCol(orgId).financeTransactions),
            orderBy('createdAt', 'desc')
        );
    }, [firestore, orgId]);

    const { data: transactions = [], isLoading: txLoading } = useCollection<FinanceTransaction>(txQuery);
    const safeTransactions = transactions || [];

    const fetchServerData = useCallback(async () => {
        if (!orgId) return;
        const [accs, comps, contrs] = await Promise.all([
            getBankAccountsAction(orgId),
            getMyCompaniesAction(orgId),
            getContractorsAction(orgId),
        ]);
        setAccounts(accs as BankAccount[]);
        setCompanies(comps as MyCompany[]);

        // Compute balances from transactions
        const completedTx = safeTransactions.filter(tx => tx.status === 'completed');
        const balanceMap: Record<string, number> = {};
        for (const tx of completedTx) {
            const key = tx.contractorId || tx.counterpartyInn;
            if (key && tx.amount) {
                const sign = tx.type === 'expense' ? 1 : -1;
                balanceMap[key] = (balanceMap[key] || 0) + (tx.amount * sign);
            }
        }
        setContractors((contrs as any[]).map(c => ({
            ...c,
            balance: balanceMap[c.id] || balanceMap[c.inn] || 0
        })));
        setLoading(false);
    }, [orgId, transactions]);

    useEffect(() => { fetchServerData(); }, [fetchServerData]);

    const getStatusVariant = (status: string) => {
        switch (status) {
            case 'completed': return 'default';
            case 'pending': return 'outline';
            case 'rejected': return 'destructive';
            default: return 'outline';
        }
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'completed': return 'Проведено';
            case 'pending': return 'Ожидает';
            case 'rejected': return 'Отклонено';
            default: return status;
        }
    };

    if (isUserLoading || (loading && !orgId)) return <PageSkeleton />;

    return (
        <div className="space-y-8 p-4">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-4xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-700 via-indigo-600 to-purple-600 uppercase">
                        ФИНАНСОВЫЙ ХАБ
                    </h1>
                    <p className="text-muted-foreground font-medium flex items-center gap-2 mt-1 italic opacity-80">
                        Центральный реестр транзакций: Telegram, API & Ручной ввод.
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={fetchServerData} className="gap-2">
                        <RefreshCw className="h-4 w-4" /> Обновить
                    </Button>
                    {orgId && (
                        <AddTransactionDialog
                            orgId={orgId}
                            accounts={accounts}
                            companies={companies as any[]}
                            contractors={contractors}
                        />
                    )}
                </div>
            </div>

            <FinanceSummary accounts={accounts} />

            <Card className="rounded-2xl border-none shadow-xl overflow-hidden bg-gradient-to-b from-white to-slate-50/30">
                <CardHeader className="border-b bg-slate-50/50">
                    <CardTitle className="text-lg font-bold flex items-center gap-2">
                        Реестр транзакций
                        {txLoading && <span className="text-xs font-normal text-muted-foreground animate-pulse">загрузка...</span>}
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-slate-50/50 hover:bg-slate-50/50">
                                <TableHead className="w-[110px] py-4">Дата / Статус</TableHead>
                                <TableHead className="py-4">Контрагент / Назначение</TableHead>
                                <TableHead className="py-4">Счета / ИНН</TableHead>
                                <TableHead className="text-right py-4">Сумма</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {safeTransactions.map((tx) => (
                                <TransactionDetailsDialog key={tx.id} transaction={tx}>
                                    <DialogTrigger asChild>
                                        <TableRow className="cursor-pointer hover:bg-slate-100/50 transition-colors">
                                            <TableCell className="font-medium align-top py-4">
                                                <div className="text-[11px] text-muted-foreground mb-1 uppercase font-bold tracking-tighter">
                                                    {tx.createdAt ? format((tx.createdAt as any).seconds * 1000, 'dd MMM p', { locale: ru }) : '—'}
                                                </div>
                                                <Badge variant={getStatusVariant(tx.status)}>
                                                    {getStatusLabel(tx.status)}
                                                </Badge>
                                                {tx.status === 'pending' && orgId && (
                                                    <div className="relative z-10 mt-1">
                                                        <TransactionActionButtons
                                                            orgId={orgId}
                                                            transaction={tx}
                                                            accounts={accounts}
                                                        />
                                                    </div>
                                                )}
                                                {tx.status === 'rejected' && tx.metadata?.aiComment && (
                                                    <div className="text-red-500 text-[10px] mt-2 italic leading-tight max-w-[120px]">
                                                        {tx.metadata.aiComment}
                                                    </div>
                                                )}
                                            </TableCell>
                                            <TableCell className="align-top py-4">
                                                <div className="flex items-center gap-2">
                                                    <div className="font-bold text-slate-800">{tx.counterparty}</div>
                                                    {tx.counterpartyInn && (
                                                        <Link href="/finance-hub/accounts" className="text-indigo-400 hover:text-indigo-600 transition-colors" title="Открыть реестр контрагентов">
                                                            <UserCheck className="w-4 h-4" />
                                                        </Link>
                                                    )}
                                                </div>
                                                <div className="text-xs text-muted-foreground mt-1 line-clamp-2 max-w-[400px]">
                                                    {tx.paymentPurpose || tx.comment || "Без назначения"}
                                                </div>
                                                <div className="mt-2 flex gap-1 flex-wrap">
                                                    <Badge variant="outline" className="text-[10px] bg-white">
                                                        {tx.source === 'telegram_bot' ? '🤖 Телеграм' : '🌐 Веб-Форма'}
                                                    </Badge>
                                                    {tx.type && (
                                                        <Badge variant="outline" className={`text-[10px] bg-white ${tx.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                                                            {tx.type === 'income' ? '+ ПРИХОД' : '- РАСХОД'}
                                                        </Badge>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell className="align-top py-4">
                                                {tx.counterpartyInn && (
                                                    <div className="flex flex-col mb-2">
                                                        <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">ИНН:</span>
                                                        <code className="text-[11px] text-blue-600 font-bold">{tx.counterpartyInn}</code>
                                                    </div>
                                                )}
                                                {tx.counterpartyAccount && (
                                                    <div className="flex flex-col">
                                                        <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">Счёт Получ.:</span>
                                                        <code className="text-[11px] text-slate-500 truncate max-w-[200px]">{tx.counterpartyAccount}</code>
                                                    </div>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right align-top py-4">
                                                <div className={`text-xl font-black ${tx.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                                                    {tx.type === 'income' ? '+' : '-'}{tx.amount?.toLocaleString('ru-RU')}
                                                </div>
                                                <div className="text-[10px] text-muted-foreground font-bold tracking-widest">
                                                    {tx.currency}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    </DialogTrigger>
                                </TransactionDetailsDialog>
                            ))}
                        </TableBody>
                    </Table>
                    {safeTransactions.length === 0 && !txLoading && (
                        <div className="text-center py-20 bg-slate-50/50">
                            <div className="text-slate-300 text-sm italic">Реестр пуст. Жду данных из Telegram...</div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
