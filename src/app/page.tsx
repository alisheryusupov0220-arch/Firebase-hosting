'use client';

import React from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useCollection, useFirestore } from '@/firebase/hooks';
import { query, collection, orderBy, limit, where } from 'firebase/firestore';
import { OrderRequest, Supplier } from '@/lib/types/erp';
import { useMemoFirebase, useFirebase } from '@/firebase/provider';

import { 
    Truck, 
    Layers, 
    AlertCircle, 
    CheckCircle2, 
    ArrowUpRight, 
    TrendingUp, 
    Calendar,
    ArrowRight,
    Search
} from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

export default function Dashboard() {
    const firestore = useFirestore();
    const { orgId } = useFirebase();

    // 1. Pending Orders
    const pendingOrdersQuery = useMemoFirebase(() => {
        if (!firestore || !orgId) return null;
        return query(
            collection(firestore, 'organizations', orgId, 'order_requests'), 
            where('status', '==', 'DRAFT'), 
            limit(5)
        );
    }, [firestore, orgId]);
    const { data: pendingOrders } = useCollection<OrderRequest>(pendingOrdersQuery);


    // 2. Active Suppliers (with non-zero balance)
    const activeSuppliersQuery = useMemoFirebase(() => {
        if (!firestore || !orgId) return null;
        return query(
            collection(firestore, 'organizations', orgId, 'suppliers'),
            orderBy('balance', 'desc'),
            limit(5)
        );
    }, [firestore, orgId]);
    const { data: suppliers } = useCollection<Supplier>(activeSuppliersQuery);

    // 3. Stats for context
    const totalDebt = (suppliers || []).reduce((acc, curr) => acc + (curr.balance > 0 ? curr.balance : 0), 0);
    const pendingCount = pendingOrders?.length || 0;

    return (
        <div className="space-y-8 pb-10">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <PageHeader 
                    title="FLOW Inventory Dashboard" 
                    description={`Сегодня ${format(new Date(), 'EEEE, d MMMM', { locale: ru })}`}
                />
                <Link href="/orders/create">
                    <Button className="rounded-2xl bg-primary hover:bg-primary/90 px-8 py-6 text-lg font-bold shadow-xl shadow-primary/20">
                        <PlusIcon className="mr-2 h-5 w-5" /> Создать Заказ
                    </Button>
                </Link>
            </div>

            {/* Top Row: Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <Card className="border-none shadow-lg bg-indigo-600 text-white rounded-3xl overflow-hidden relative">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-12 translate-x-12 blur-2xl" />
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-bold opacity-80 uppercase tracking-wider flex items-center gap-2">
                            <Truck className="h-4 w-4" />
                            Активный долг
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-black">
                            {totalDebt.toLocaleString()} <span className="text-sm">сум</span>
                        </div>
                        <p className="text-xs text-indigo-100 mt-2 flex items-center gap-1">
                           <TrendingUp className="h-3 w-3" /> На 5% выше прошлого месяца
                        </p>
                    </CardContent>
                </Card>

                <Card className="border-none shadow-lg bg-rose-500 text-white rounded-3xl overflow-hidden relative">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-bold opacity-80 uppercase tracking-wider flex items-center gap-2">
                            <AlertCircle className="h-4 w-4" />
                            Черновики заказов
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-black">
                            {pendingCount}
                        </div>
                        <p className="text-xs text-rose-100 mt-2">Требуют утверждения менеджера</p>
                    </CardContent>
                </Card>

                <Card className="border-none shadow-lg bg-emerald-500 text-white rounded-3xl overflow-hidden relative">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-bold opacity-80 uppercase tracking-wider flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4" />
                            Завершено (7д)
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-black">
                            12
                        </div>
                        <p className="text-xs text-emerald-100 mt-2">Все данные в Poster синхронизированы</p>
                    </CardContent>
                </Card>

                <Card className="border-none shadow-lg bg-amber-500 text-white rounded-3xl overflow-hidden relative">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-bold opacity-80 uppercase tracking-wider flex items-center gap-2">
                            <Layers className="h-4 w-4" />
                            Крит. остатки
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-black">
                            4
                        </div>
                        <p className="text-xs text-amber-100 mt-2 font-medium underline cursor-pointer">Просмотреть позиции</p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Pending Tasks Section */}
                <Card className="border-none shadow-2xl rounded-3xl overflow-hidden bg-card">
                    <CardHeader className="bg-muted/30 pb-4">
                        <div className="flex justify-between items-center">
                            <div>
                                <CardTitle className="text-xl font-black">Ожидают действия</CardTitle>
                                <CardDescription>Заказы со статусом DRAFT / APPROVED</CardDescription>
                            </div>
                            <Link href="/orders">
                                <Button variant="ghost" size="sm" className="text-primary font-bold">Весь список <ArrowRight className="ml-2 h-4 w-4" /></Button>
                            </Link>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        {(pendingOrders || []).length === 0 ? (
                            <div className="p-10 text-center text-muted-foreground italic">Все задачи выполнены!</div>
                        ) : (
                            <div className="divide-y divide-border/50">
                                {pendingOrders?.map(order => (
                                    <Link key={order.id} href={`/orders/${order.id}`}>
                                        <div className="p-6 hover:bg-muted/20 transition-all flex items-center justify-between group">
                                            <div className="flex items-center gap-4">
                                                <div className="h-12 w-12 rounded-2xl bg-rose-500/10 flex items-center justify-center text-rose-500 group-hover:scale-110 transition-transform">
                                                    <Calendar className="h-6 w-6" />
                                                </div>
                                                <div>
                                                    <p className="font-black text-foreground/90">{order.supplierName}</p>
                                                    <p className="text-xs text-muted-foreground">ID: {order.id.slice(-6).toUpperCase()} • {format(order.createdAt?.toDate() || new Date(), 'dd.MM HH:mm')}</p>
                                                </div>
                                            </div>
                                            <Badge variant="outline" className="bg-rose-500/10 text-rose-500 border-rose-500/20 px-3 py-1 font-bold">
                                                DRAFT
                                            </Badge>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Top Debtors Section */}
                 <Card className="border-none shadow-2xl rounded-3xl overflow-hidden bg-card">
                    <CardHeader className="bg-muted/30 pb-4">
                        <div className="flex justify-between items-center">
                            <div>
                                <CardTitle className="text-xl font-black">Задолженности</CardTitle>
                                <CardDescription>Контрагенты с наибольшим балансом</CardDescription>
                            </div>
                            <Link href="/finance-hub/accounts">
                                <Button variant="ghost" size="sm" className="text-primary font-bold">Управление <ArrowRight className="ml-2 h-4 w-4" /></Button>
                            </Link>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                         <div className="divide-y divide-border/50">
                            {suppliers?.slice(0, 5).map(s => (
                                <div key={s.id} className="p-6 flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="h-12 w-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-500">
                                            <LandmarkIcon className="h-6 w-6" />
                                        </div>
                                        <div>
                                            <p className="font-black text-foreground/90">{s.name}</p>
                                            <p className="text-xs text-muted-foreground">{s.contactPerson || 'Нет контакта'}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-black text-xl text-foreground">{s.balance.toLocaleString()}</p>
                                        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">сум</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

function PlusIcon(props: any) {
    return (
        <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
    )
}

function LandmarkIcon(props: any) {
    return (
        <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="22" x2="21" y2="22"/><line x1="6" y1="18" x2="6" y2="11"/><line x1="10" y1="18" x2="10" y2="11"/><line x1="14" y1="18" x2="14" y2="11"/><line x1="18" y1="18" x2="18" y2="11"/><polygon points="12 2 20 7 4 7 12 2"/></svg>
    )
}
