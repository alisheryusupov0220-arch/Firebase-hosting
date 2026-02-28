'use client';

import React from 'react';
import { useCollection, useFirestore, useUser, useDoc } from '@/firebase/hooks';
import { collection, query, where, orderBy, doc } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { approveSupplyAction, rejectSupplyAction } from '@/app/supplies/actions';
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

type UserProfile = {
    role: 'admin' | 'employee';
};

export function PendingSuppliesCard({ storages, suppliers, ingredients }: PendingSuppliesCardProps) {
    const { toast } = useToast();
    const firestore = useFirestore();
    const { user, loading: userLoading } = useUser();

    // Fetch user profile to check for admin role
    const userProfileRef = useMemoFirebase(() => {
        if (!firestore || !user?.uid) return null;
        return doc(firestore, 'users', user.uid);
    }, [firestore, user?.uid]);
    const { data: userProfile, isLoading: profileLoading } = useDoc<UserProfile>(userProfileRef);
    const isAdmin = userProfile?.role === 'admin';
    
    const pendingSuppliesQuery = useMemoFirebase(() => {
        if (!firestore || !isAdmin) return null; // Only query if user is an admin
        return query(
            collection(firestore, 'pendingSupplies'),
            where('status', '==', 'pending'),
            orderBy('createdAt', 'desc')
        );
    }, [firestore, isAdmin]);

    const { data: pendingSupplies, isLoading: suppliesLoading, error } = useCollection(pendingSuppliesQuery);
    
    const dataMap = React.useMemo(() => ({
        storages: new Map(storages.map(item => [item.storage_id, item.storage_name])),
        suppliers: new Map(suppliers.map(item => [item.supplier_id, item.supplier_name])),
        ingredients: new Map(ingredients.map(item => [item.ingredient_id, item.ingredient_name])),
    }), [storages, suppliers, ingredients]);

    const handleApprove = async (id: string) => {
        const result = await approveSupplyAction(id);
        if (result.success) {
            toast({ title: 'Успех!', description: 'Поставка одобрена и отправлена в Poster.' });
        } else {
            toast({ variant: 'destructive', title: 'Ошибка!', description: result.message });
        }
    };

    const handleReject = async (id: string) => {
        const result = await rejectSupplyAction(id);
        if (result.success) {
            toast({ title: 'Успех!', description: 'Заявка на поставку отклонена.' });
        } else {
            toast({ variant: 'destructive', title: 'Ошибка!', description: result.message });
        }
    };

    const isLoading = userLoading || profileLoading || suppliesLoading;
    
    // Don't render anything for non-admins or if there are no pending supplies
    if ((!isLoading && !isAdmin) || (!isLoading && isAdmin && pendingSupplies?.length === 0)) {
        return null; 
    }
    
    // Show a loading state specifically for the admin card
    if (isLoading && !user) {
        return null; // Don't show skeleton if user is not even logged in yet.
    }
    
    if (isLoading && isAdmin) {
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
                    <CardTitle>Ошибка</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-destructive">Не удалось загрузить заявки: {error.message}</p>
                </CardContent>
            </Card>
        );
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
                        {pendingSupplies?.map((supply) => {
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
                                        {new Intl.NumberFormat('uz-UZ', { style: 'currency', currency: 'UZS' }).format(totalSum)}
                                    </TableCell>
                                    <TableCell className="text-right space-x-2">
                                        <Button size="sm" onClick={() => handleApprove(supply.id)}>Одобрить</Button>
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
