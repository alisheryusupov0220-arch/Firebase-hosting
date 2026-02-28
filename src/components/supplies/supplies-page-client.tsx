'use client';

import React, { useState, useEffect } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { SuppliesPageHeader } from "@/components/supplies/supplies-page-header";
import { PendingSuppliesCard } from "@/components/supplies/pending-supplies-card";
import { type LocalIngredient } from "@/app/ingredients/actions";
import { fetchStoragesAction, fetchSuppliersAction } from '@/app/supplies/actions';
import type { Supply, Storage, PosterSupplier } from '@/lib/poster';
import { Skeleton } from '@/components/ui/skeleton';
import { useCollection, useFirestore } from '@/firebase/hooks';
import { useMemoFirebase } from '@/firebase/provider';
import { collection, query, orderBy } from 'firebase/firestore';

type SuppliesPageClientProps = {
    initialSupplies: Supply[];
};

const PageSkeleton = () => (
    <div className="space-y-8">
        <div className="flex items-start justify-between">
            <div>
                <Skeleton className="h-9 w-48" />
                <Skeleton className="h-4 w-72 mt-2" />
            </div>
            <Skeleton className="h-10 w-40" />
        </div>
        <Card>
            <CardHeader>
                <Skeleton className="h-6 w-1/3" />
                <Skeleton className="h-4 w-2/3" />
            </CardHeader>
            <CardContent>
                 <div className="space-y-2">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                </div>
            </CardContent>
        </Card>
    </div>
);


export function SuppliesPageClient({ initialSupplies }: SuppliesPageClientProps) {
    const [storages, setStorages] = useState<Storage[]>([]);
    const [suppliers, setSuppliers] = useState<PosterSupplier[]>([]);
    const [loading, setLoading] = useState(true);

    const firestore = useFirestore();
    const ingredientsQuery = useMemoFirebase(() => 
        firestore 
            ? query(collection(firestore, 'ingredients_master'), orderBy('name', 'asc'))
            : null
    , [firestore]);

    const { data: ingredients, isLoading: ingredientsLoading } = useCollection<LocalIngredient>(ingredientsQuery);

    useEffect(() => {
        const fetchDropdownData = async () => {
            const [storagesData, suppliersData] = await Promise.all([
                fetchStoragesAction(),
                fetchSuppliersAction(),
            ]);
            setStorages(storagesData);
            setSuppliers(suppliersData);
        };
        fetchDropdownData();
    }, []);

    useEffect(() => {
        if (!ingredientsLoading) {
            setLoading(false);
        }
    }, [ingredientsLoading]);

    const getStatusVariant = (status: string) => {
        switch (status) {
        case '1': return 'secondary'; // open
        case '2': return 'default'; // closed
        default: return 'outline';
        }
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
        case '1': return 'Открыта';
        case '2': return 'Закрыта';
        default: return 'Неизвестно';
        }
    };
    
    if (loading) {
        return <PageSkeleton />;
    }

    return (
        <div className="space-y-8">
            <SuppliesPageHeader
                ingredients={ingredients}
            />

            <PendingSuppliesCard 
                storages={storages}
                suppliers={suppliers}
                ingredients={ingredients || []}
            />
        
            <Card>
                <CardHeader>
                    <CardTitle>Последние поставки</CardTitle>
                    <CardDescription>Список недавних поставок, полученных из Poster.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[100px]">ID</TableHead>
                                <TableHead>Дата</TableHead>
                                <TableHead>Поставщик</TableHead>
                                <TableHead className="text-right">Сумма</TableHead>
                                <TableHead>Статус</TableHead>
                                <TableHead>Комментарий</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {initialSupplies.length > 0 ? (
                                initialSupplies.map((supply) => (
                                    <TableRow key={supply.supply_id}>
                                        <TableCell className="font-medium">{supply.supply_id}</TableCell>
                                        <TableCell>{supply.date_created ? format(new Date(supply.date_created.replace(' ', 'T')), 'dd.MM.yyyy HH:mm') : '-'}</TableCell>
                                        <TableCell>{supply.supplier_name || '-'}</TableCell>
                                        <TableCell className="text-right">{new Intl.NumberFormat('uz-UZ', { style: 'currency', currency: 'UZS' }).format(Number(supply.supply_sum) / 100)}</TableCell>
                                        <TableCell>
                                            <Badge variant={getStatusVariant(supply.supply_status)}>
                                                {getStatusLabel(supply.supply_status)}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>{supply.comment || '-'}</TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-24 text-center">
                                        Поставок не найдено.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
