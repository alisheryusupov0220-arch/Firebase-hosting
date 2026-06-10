'use client';

import React, { useState } from 'react';
import { useCollection, useFirestore } from '@/firebase/hooks';
import { useMemoFirebase, useFirebase } from '@/firebase/provider';
import { collection, query, orderBy } from 'firebase/firestore';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { Search, FileText, CheckCircle2, IndianRupee, Clock, ArrowUpRight, Truck, ShieldCheck, Zap, ArrowRight } from 'lucide-react';
import Link from 'next/link';

type AccountPayable = {
  id: string;
  orderId: string;
  supplierId: string;
  supplierName: string;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  status: 'WAITING_INVOICE' | 'INVOICE_RECEIVED' | 'PAID' | 'PARTIAL';
  posterSupplyId?: string;
  createdAt: any;
  updatedAt: any;
};

export function PayablePageClient() {
  const { orgId } = useFirebase();
  const [searchTerm, setSearchTerm] = useState('');
  const firestore = useFirestore();

  const payablesQuery = useMemoFirebase(() => {
    if (!firestore || !orgId) return null;
    return query(collection(firestore, 'organizations', orgId, 'accounts_payable'), orderBy('createdAt', 'desc'));
  }, [firestore, orgId]);

  const { data: payables, isLoading } = useCollection<AccountPayable>(payablesQuery);

  const filteredPayables = payables?.filter((p) =>
    p.supplierName.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.orderId.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const totalOwed = filteredPayables.reduce((acc, p) => acc + (p.remainingAmount || 0), 0);
  const totalPaid = filteredPayables.reduce((acc, p) => acc + (p.paidAmount || 0), 0);

  const getStatusBadge = (status: AccountPayable['status']) => {
    switch (status) {
      case 'WAITING_INVOICE':
        return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-200 border-none font-bold text-[10px] uppercase tracking-wider px-2 py-0.5"><Clock className="w-3 h-3 mr-1 inline" /> Ожидает счет</Badge>;
      case 'INVOICE_RECEIVED':
        return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-200 border-none font-bold text-[10px] uppercase tracking-wider px-2 py-0.5"><FileText className="w-3 h-3 mr-1 inline" /> Счет получен</Badge>;
      case 'PARTIAL':
        return <Badge className="bg-indigo-100 text-indigo-800 hover:bg-indigo-200 border-none font-bold text-[10px] uppercase tracking-wider px-2 py-0.5"><IndianRupee className="w-3 h-3 mr-1 inline" /> Частично оплачен</Badge>;
      case 'PAID':
        return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border-none font-bold text-[10px] uppercase tracking-wider px-2 py-0.5"><CheckCircle2 className="w-3 h-3 mr-1 inline" /> Полностью оплачен</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (isLoading) {
    return <div className="p-12 text-center animate-pulse text-slate-400 font-bold uppercase tracking-widest">ЗАГРУЗКА ИСТОРИИ...</div>;
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tight text-slate-900">Взаиморасчеты</h1>
          <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mt-1">История поставок и сверка со счетами</p>
        </div>
        <div className="flex items-center gap-4 w-full md:w-auto">
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Поиск по поставщику или №..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-11 bg-white border-none shadow-sm rounded-xl font-bold text-sm w-full focus-visible:ring-primary/20"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="rounded-[2rem] border-none shadow-sm bg-gradient-to-br from-white to-slate-50 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/5 rounded-full blur-3xl" />
          <CardContent className="p-8 space-y-2">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">ТЕКУЩИЙ ДОЛГ (К ОПЛАТЕ)</p>
            <p className="text-4xl font-black text-rose-500 tabular-nums">
              {totalOwed.toLocaleString()} <span className="text-xl opacity-50 uppercase">сум</span>
            </p>
          </CardContent>
        </Card>
        <Card className="rounded-[2rem] border-none shadow-sm bg-gradient-to-br from-white to-slate-50 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl" />
          <CardContent className="p-8 space-y-2">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">УЖЕ ОПЛАЧЕНО</p>
            <p className="text-4xl font-black text-emerald-500 tabular-nums">
              {totalPaid.toLocaleString()} <span className="text-xl opacity-50 uppercase">сум</span>
            </p>
          </CardContent>
        </Card>
        <Card className="rounded-[2rem] border-none shadow-sm bg-gradient-to-br from-white to-slate-50 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl" />
          <CardContent className="p-8 space-y-2">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">ТРАНЗАКЦИЙ ОЖИДАЕТ</p>
            <p className="text-4xl font-black text-slate-900 tabular-nums">
              {filteredPayables.filter(p => p.status === 'WAITING_INVOICE' || p.status === 'INVOICE_RECEIVED').length} <span className="text-xl opacity-50 uppercase">шт</span>
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-[2rem] border-none shadow-sm overflow-hidden">
        <CardHeader className="bg-white px-8 pt-8 pb-6 border-b border-slate-100">
          <CardTitle className="text-lg font-black uppercase tracking-tight">Реестр Поставок</CardTitle>
          <CardDescription className="text-xs font-bold text-slate-400 uppercase tracking-wider">Все проведенные в Постер накладные</CardDescription>
        </CardHeader>
        <CardContent className="p-0 bg-white">
          <Table>
            <TableHeader className="bg-slate-50/50">
              <TableRow className="border-slate-100 hover:bg-transparent">
                <TableHead className="text-[10px] font-black uppercase text-slate-400 w-32 px-8 py-4">Дата</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-slate-400 w-32 text-center">Номер</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-slate-400">Поставщик</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-slate-400 text-center">Контроль</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-slate-400 text-right">Сумма Накладной</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-slate-400 text-right">Статус Сверки</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-slate-400 text-right px-8">Завершить</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPayables.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center text-slate-400 font-bold uppercase tracking-widest text-xs">
                    Ничего не найдено
                  </TableCell>
                </TableRow>
              ) : (
                filteredPayables.map((payable) => (
                  <TableRow key={payable.id} className="border-slate-100 hover:bg-slate-50/50 transition-colors h-16 group">
                    <TableCell className="px-8 font-bold text-xs text-slate-600">
                      {payable.createdAt ? format(payable.createdAt.toDate(), 'dd.MM.yyyy') : '---'}
                    </TableCell>
                    <TableCell className="text-center">
                       <div className="flex flex-col items-center gap-1">
                           <Badge variant="outline" className="font-black text-[10px] uppercase text-slate-500 bg-white rounded-md border-slate-200">
                             FLOW #{payable.orderId.slice(-6).toUpperCase()}
                           </Badge>
                           {payable.posterSupplyId && (
                              <a href={`https://joinposter.com/manage/calculations/supply#${payable.posterSupplyId}`} target="_blank" rel="noreferrer" className="text-[10px] font-black uppercase text-blue-500 hover:underline">
                                 Poster #{payable.posterSupplyId}
                              </a>
                           )}
                       </div>
                    </TableCell>
                    <TableCell className="font-black text-sm uppercase text-slate-900">
                      {payable.supplierName}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-2">
                        <div className="flex flex-col items-center gap-1 group/tooltip relative" title="Приемка пройдена">
                          <div className="w-6 h-6 rounded-full bg-emerald-100/50 text-emerald-600 flex items-center justify-center border border-emerald-200">
                             <Truck className="w-3 h-3" />
                          </div>
                        </div>
                        <div className="w-2 h-px bg-slate-200" />
                        <div className="flex flex-col items-center gap-1 group/tooltip relative" title="Взвешивание пройдено">
                          <div className="w-6 h-6 rounded-full bg-emerald-100/50 text-emerald-600 flex items-center justify-center border border-emerald-200">
                             <ShieldCheck className="w-3 h-3" />
                          </div>
                        </div>
                        <div className="w-2 h-px bg-slate-200" />
                        <div className="flex flex-col items-center gap-1 group/tooltip relative" title="Успешно проведено в Poster">
                          <div className="w-6 h-6 rounded-full bg-emerald-100/50 text-emerald-600 flex items-center justify-center border border-emerald-200">
                             <Zap className="w-3 h-3 fill-emerald-600" />
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-black text-sm tabular-nums text-slate-900">
                      {payable.totalAmount.toLocaleString()} сум
                    </TableCell>
                    <TableCell className="text-right">
                      {getStatusBadge(payable.status)}
                    </TableCell>
                    <TableCell className="px-8 text-right">
                       <Link href={`/orders/${payable.orderId}`}>
                          <Button variant="outline" className="h-8 rounded-full border-primary/20 hover:bg-primary hover:text-white transition-all text-[10px] font-black uppercase shadow-none text-primary bg-primary/5">
                             Оплатить <ArrowRight className="ml-1 h-3 w-3" />
                          </Button>
                       </Link>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
