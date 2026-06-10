'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Landmark, Wallet, Layers, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import { BankAccount } from '@/lib/types/finance';

interface FinanceSummaryProps {
    accounts: BankAccount[];
}

export function FinanceSummary({ accounts }: FinanceSummaryProps) {
    const totalBalance = accounts.reduce((sum, acc) => sum + (acc.balance || 0), 0);
    const bankBalance = accounts.filter(a => a.type === 'BANK').reduce((sum, acc) => sum + (acc.balance || 0), 0);
    const cashBalance = accounts.filter(a => a.type === 'CASH').reduce((sum, acc) => sum + (acc.balance || 0), 0);

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* TOTAL */}
            <Card className="rounded-[2rem] border-none shadow-2xl bg-black text-white overflow-hidden relative group">
                <CardContent className="p-8">
                    <div className="flex justify-between items-start">
                        <div className="space-y-4">
                            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40">Общий капитал</p>
                            <h3 className="text-4xl font-black tracking-tighter">
                                {totalBalance.toLocaleString()} <span className="text-xs font-normal text-white/50">UZS</span>
                            </h3>
                            <div className="flex items-center gap-2">
                                <div className="px-3 py-1 bg-white/10 rounded-full text-[9px] font-bold uppercase tracking-widest flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                    Live Balance
                                </div>
                            </div>
                        </div>
                        <div className="p-4 bg-white/10 rounded-3xl group-hover:scale-110 transition-transform">
                            <Layers className="w-8 h-8" />
                        </div>
                    </div>
                </CardContent>
                <div className="absolute -bottom-8 -right-8 w-32 h-32 bg-white/5 rounded-full blur-3xl" />
            </Card>

            {/* BANK */}
            <Card className="rounded-[2rem] border-none shadow-2xl bg-white overflow-hidden group">
                <CardContent className="p-8">
                    <div className="flex justify-between items-start">
                        <div className="space-y-4">
                            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">На счетах в банке</p>
                            <h3 className="text-4xl font-black tracking-tighter text-blue-600">
                                {bankBalance.toLocaleString()} <span className="text-xs font-normal text-muted-foreground">UZS</span>
                            </h3>
                            <div className="flex items-center gap-4">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                                    <ArrowUpRight className="w-3 h-3" /> Digital Assets
                                </span>
                            </div>
                        </div>
                        <div className="p-4 bg-blue-50 text-blue-600 rounded-3xl group-hover:rotate-12 transition-transform">
                            <Landmark className="w-8 h-8" />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* CASH */}
            <Card className="rounded-[2rem] border-none shadow-2xl bg-white overflow-hidden group">
                <CardContent className="p-8">
                    <div className="flex justify-between items-start">
                        <div className="space-y-4">
                            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">Наличные средства</p>
                            <h3 className="text-4xl font-black tracking-tighter text-emerald-600">
                                {cashBalance.toLocaleString()} <span className="text-xs font-normal text-muted-foreground">UZS</span>
                            </h3>
                            <div className="flex items-center gap-4">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                                    <ArrowDownLeft className="w-3 h-3" /> Liquid Cash
                                </span>
                            </div>
                        </div>
                        <div className="p-4 bg-emerald-50 text-emerald-600 rounded-3xl group-hover:scale-90 transition-transform">
                            <Wallet className="w-8 h-8" />
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
