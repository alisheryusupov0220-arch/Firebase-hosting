'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Users, FileCheck, CreditCard, ArrowUpRight, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { FinanceTransaction } from '@/lib/types/finance';

interface FinanceSummaryProps {
    contractors: any[];
    transactions: FinanceTransaction[];
}

export function FinanceSummary({ contractors = [], transactions = [] }: FinanceSummaryProps) {
    // Total debt owed to suppliers (sum of contractor positive balances)
    const totalSupplierDebt = contractors.reduce((sum, c) => sum + Math.max(0, c.balance || 0), 0);

    // Pending transactions / invoices awaiting verification (e.g., Didox draft check)
    const pendingInvoices = transactions.filter(t => t.status === 'pending');

    // Total payments executed to suppliers (expense transactions marked completed)
    const totalPayments = transactions
        .filter(t => t.status === 'completed' && t.type === 'expense')
        .reduce((sum, t) => sum + (t.amount || 0), 0);

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* TOTAL CONTRACTOR DEBT */}
            <Card className="rounded-[2rem] border-none shadow-2xl bg-black text-white overflow-hidden relative group">
                <CardContent className="p-8">
                    <div className="flex justify-between items-start">
                        <div className="space-y-4">
                            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-rose-400">Долг поставщикам (К оплате)</p>
                            <h3 className="text-4xl font-black tracking-tighter text-white">
                                {totalSupplierDebt.toLocaleString()} <span className="text-xs font-normal text-white/50">UZS</span>
                            </h3>
                            <div className="flex items-center gap-2">
                                <div className="px-3 py-1 bg-rose-500/20 text-rose-300 rounded-full text-[9px] font-bold uppercase tracking-widest flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
                                    {contractors.filter(c => (c.balance || 0) > 0).length} контрагентов с долгом
                                </div>
                            </div>
                        </div>
                        <div className="p-4 bg-white/10 rounded-3xl group-hover:scale-110 transition-transform text-rose-400">
                            <Users className="w-8 h-8" />
                        </div>
                    </div>
                </CardContent>
                <div className="absolute -bottom-8 -right-8 w-32 h-32 bg-rose-500/10 rounded-full blur-3xl" />
            </Card>

            {/* PENDING DEDOX / INVOICE VERIFICATION */}
            <Card className="rounded-[2rem] border-none shadow-2xl bg-white overflow-hidden group border border-slate-100">
                <CardContent className="p-8">
                    <div className="flex justify-between items-start">
                        <div className="space-y-4">
                            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-amber-600">Счета на подпись / Сверку</p>
                            <h3 className="text-4xl font-black tracking-tighter text-slate-900">
                                {pendingInvoices.length} <span className="text-xs font-normal text-muted-foreground">документов</span>
                            </h3>
                            <div className="flex items-center gap-4">
                                <span className="text-[10px] font-bold text-amber-600 uppercase tracking-widest flex items-center gap-1">
                                    <ShieldAlert className="w-3 h-3" /> Черновик сверки с Дедокс
                                </span>
                            </div>
                        </div>
                        <div className="p-4 bg-amber-50 text-amber-600 rounded-3xl group-hover:rotate-12 transition-transform">
                            <FileCheck className="w-8 h-8" />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* TOTAL PAYMENTS EXECUTED */}
            <Card className="rounded-[2rem] border-none shadow-2xl bg-white overflow-hidden group border border-slate-100">
                <CardContent className="p-8">
                    <div className="flex justify-between items-start">
                        <div className="space-y-4">
                            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-600">Оплачено поставщикам</p>
                            <h3 className="text-4xl font-black tracking-tighter text-emerald-600">
                                {totalPayments.toLocaleString()} <span className="text-xs font-normal text-muted-foreground">UZS</span>
                            </h3>
                            <div className="flex items-center gap-4">
                                <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest flex items-center gap-1">
                                    <CheckCircle2 className="w-3 h-3" /> Проведенные счета
                                </span>
                            </div>
                        </div>
                        <div className="p-4 bg-emerald-50 text-emerald-600 rounded-3xl group-hover:scale-90 transition-transform">
                            <CreditCard className="w-8 h-8" />
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
