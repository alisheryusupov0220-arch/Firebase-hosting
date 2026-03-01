'use client';

import React from 'react';
import { useCollection, useFirestore, useUser } from '@/firebase/hooks';
import { collection, query, doc, updateDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { approveSupplyOnPosterAction } from '@/app/supplies/actions';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { Ingredient, PosterSupplier, Storage } from '@/lib/poster';
import { useMemoFirebase } from '@/firebase/provider';
import { Skeleton } from '../ui/skeleton';

type PendingSuppliesCardProps = {
    storages: Storage[];
    suppliers: PosterSupplier[];
    ingredients: Ingredient[];
};


export function PendingSuppliesCard({ storages, suppliers, ingredients }: PendingSuppliesCardProps) {
    const { toast } = useToast();
    const firestore = useFirestore();
    const { user } = useUser();
    
    const pendingSuppliesQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        // DIAGNOSTIC: Temporarily simplify query to isolate permission issue.
        // The original query had `where` and `orderBy` clauses.
        return query(collection(firestore, 'pendingSupplies'));
    }, [firestore]);

    const { data: pendingSupplies, isLoading, error } = useCollection(pendingSuppliesQuery);
    
    const dataMap = React.useMemo(() => ({
        storages: new Map(storages.map(item => [item.storage_id, item.storage_name])),
        suppliers: new Map(suppliers.map(item => [item.supplier_id, item.supplier_name])),
        ingredients: new Map(ingredients.map(item => [item.ingredient_id, item.ingredient_name])),
    }), [storages, suppliers, ingredients]);

    const handleApprove = async (supply: any) => {
        if (!user || !firestore) {
            toast({ variant: 'destructive', title: 'Ошибка!', description: 'Вы не авторизованы.' });
            return;
        }

        const result = await approveSupplyOnPosterAction(supply.id);

        if (!result.success) {
            toast({ variant: 'destructive', title: 'Ошибка Poster!', description: result.message });
            return;
        }

        const newSupplyId = result.data;
        const pendingSupplyRef = doc(firestore, 'pendingSupplies', supply.id);
        
        try {
            const batch = writeBatch(firestore);

            batch.update(pendingSupplyRef, {
                status: 'approved',
                approvedBy: user.email,
                approvedAt: serverTimestamp(),
                posterSupplyId: newSupplyId,
            });

            const approvalTimestamp = new Date();
            supply.ingredients.forEach((ingredient: any) => {
                const priceHistoryRef = doc(firestore, `ingredients/${ingredient.ingredient_id}/price_history`, String(newSupplyId));
                batch.set(priceHistoryRef, {
                    price: ingredient.price,
                    date: approvalTimestamp,
                    supplierId: String(supply.supplier_id)
                });
            });

            await batch.commit();
            toast({ title: 'Успех!', description: 'Поставка одобрена.' });

        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Ошибка Firestore!', description: `Не удалось обновить статус заявки: ${e.message}` });
        }
    };

    const handleReject = async (id: string) => {
        if (!user || !firestore) {
            toast({ variant: 'destructive', title: 'Ошибка!', description: 'Вы не авторизованы.' });
            return;
        }
        const pendingSupplyRef = doc(firestore, 'pendingSupplies', id);
        try {
            await updateDoc(pendingSupplyRef, {
                status: 'rejected',
                rejectedBy: user.email,
                rejectedAt: serverTimestamp(),
            });
            toast({ title: 'Успех!', description: 'Заявка на поставку отклонена.' });
        } catch(e: any) {
            toast({ variant: 'destructive', title: 'Ошибка!', description: `Ошибка отклонения: ${e.message}` });
        }
    };
    
    if (isLoading) {
         return (
            <Card>
                <CardHeader>
                    <Skeleton className="h-6 w-1/2" />
                    <Skeleton className="h-4 w-3/4" />
                </CardHeader>
                <CardContent>
                    <div className="space-y-2">
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                    </div>
                </CardContent>
            </Card>
        );
    }
    
    if (error) {
         return (
            <Card>
                <CardHeader>
                    <CardTitle>Ошибка загрузки заявок</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-destructive">{error.message}</p>
                </CardContent>
            </Card>
        );
    }

    if (!pendingSupplies || pendingSupplies.length === 0) {
        return null; 
    }
    
    const filteredSupplies = pendingSupplies.filter((s: any) => s.status === 'pending');

    if (filteredSupplies.length === 0) {
        return null;
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Ожидают подтверждения</CardTitle>
                <CardDescription>Заявки на поставку, требующие вашего одобрения.</CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Дата</TableHead>
                            <TableHead>Сотрудник</TableHead>
                            <TableHead>Поставщик</TableHead>
                            <TableHead>Склад</TableHead>
                            <TableHead className="text-right">Сумма</TableHead>
                            <TableHead className="text-right">Действия</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredSupplies.map((supply: any) => {
                             const totalSum = supply.ingredients.reduce((acc: number, ing: any) => acc + (ing.count * ing.price), 0);
                             return (
                                <TableRow key={supply.id}>
                                    <TableCell>
                                        {supply.createdAt ? format(supply.createdAt.toDate(), 'dd.MM.yyyy HH:mm') : '-'}
                                    </TableCell>
                                    <TableCell>{supply.requesterName}</TableCell>
                                    <TableCell>{dataMap.suppliers.get(String(supply.supplier_id)) || supply.supplier_id}</TableCell>
                                    <TableCell>{dataMap.storages.get(String(supply.storage_id)) || supply.storage_id}</TableCell>
                                    <TableCell className="text-right">
                                        {new Intl.NumberFormat('uz-UZ', { style: 'currency', currency: 'UZS', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(totalSum)}
                                    </TableCell>
                                    <TableCell className="text-right space-x-2">
                                        <Button size="sm" onClick={() => handleApprove(supply)}>Одобрить</Button>
                                        <Button size="sm" variant="outline" onClick={() => handleReject(supply.id)}>Отклонить</Button>
                                    </TableCell>
                                </TableRow>
                             )
                        })}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
