'use client';

import React, { useTransition, useMemo } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { useCollection, useFirestore } from '@/firebase/hooks';
import { collection, query, orderBy } from 'firebase/firestore';
import { useMemoFirebase } from '@/firebase/provider';
import { ShoppingCart, PlusCircle, Calendar, ShieldCheck } from 'lucide-react';
import { OrderRequest, OrderStatus } from '@/lib/types/erp';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

export default function OrdersPage() {
    const { toast } = useToast();
    const firestore = useFirestore();

    const ordersQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'order_requests'), orderBy('createdAt', 'desc'));
    }, [firestore]);

    const { data: orders, isLoading, error } = useCollection<OrderRequest>(ordersQuery);

    const getStatusVariant = (status: OrderStatus) => {
        switch (status) {
            case 'DRAFT': return 'outline';
            case 'APPROVED': return 'secondary';
            case 'VERIFIED_ON_GATE': return 'default';
            case 'FINAL_WEIGHTED': return 'destructive'; // Critical/Ready
            case 'POSTED_TO_POSTER': return 'success' as any;
            default: return 'outline';
        }
    };

    const getStatusLabel = (status: OrderStatus) => {
        switch (status) {
            case 'DRAFT': return 'Черновик';
            case 'APPROVED': return 'Одобрен';
            case 'VERIFIED_ON_GATE': return 'На рампе';
            case 'FINAL_WEIGHTED': return 'Взвешен';
            case 'POSTED_TO_POSTER': return 'В Poster';
            default: return status;
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-start justify-between">
                <PageHeader 
                    title="Заявки FLOW" 
                    description="Цепочка заказов: от лимитов до поступления в Poster."
                />
                <Button>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Создать заявку
                </Button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-blue-500" />
                            Сегодня по графику
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-bold">Молоко, Овощи</p>
                        <p className="text-xs text-muted-foreground mt-1">Не забудьте проверить лимиты Max.</p>
                    </CardContent>
                </Card>
                
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <ShieldCheck className="h-4 w-4 text-amber-500" />
                            Требуют верификации
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-bold">{orders?.filter(o => o.status === 'APPROVED').length || 0}</p>
                        <p className="text-xs text-muted-foreground mt-1">Ожидают на рампе/взвешивания.</p>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <ShoppingCart className="h-5 w-5" />
                        Активные заказы
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Дата</TableHead>
                                <TableHead>Поставщик</TableHead>
                                <TableHead>Тип лимита</TableHead>
                                <TableHead>Статус</TableHead>
                                <TableHead className="text-right">Действия</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading && (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-24 text-center">Загрузка заявок...</TableCell>
                                </TableRow>
                            )}
                            {!isLoading && orders?.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                                        Заявок пока нет.
                                    </TableCell>
                                </TableRow>
                            )}
                            {orders?.map((order) => (
                                <TableRow key={order.id}>
                                    <TableCell className="text-sm">
                                        {order.createdAt ? format(order.createdAt.toDate(), 'dd MMM, HH:mm', { locale: ru }) : '—'}
                                    </TableCell>
                                    <TableCell className="font-medium">
                                        {order.supplierId} {/* Will need to map to name */}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className={order.limitType === 'MAX' ? 'border-amber-500 text-amber-500' : ''}>
                                            {order.limitType}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={getStatusVariant(order.status)}>
                                            {getStatusLabel(order.status)}
                                            {order.hasCriticalDiscrepancy && " ⚠️"}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="sm">Детали</Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
