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
import { type ERPItem, type Supplier } from "@/lib/types/erp";
import { fetchStoragesAction, fetchSuppliersAction, fetchSuppliesAction } from '@/app/supplies/actions';
import { type Supply, type Storage, type PosterSupplier } from '@/lib/poster';
import { Skeleton } from '@/components/ui/skeleton';
import { useCollection, useFirestore } from '@/firebase/hooks';
import { useMemoFirebase, useFirebase } from '@/firebase/provider';
import { collection, query, orderBy } from 'firebase/firestore';
import Link from 'next/link';
import { AlertCircle } from 'lucide-react';

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
                    <Skeleton className="h-12 w-full" />
                </div>
            </CardContent>
        </Card>
    </div>
);

export function SuppliesPageClient() {
    const { orgId } = useFirebase();
    const [storages, setStorages] = useState<Storage[]>([]);
    const [posterSuppliers, setPosterSuppliers] = useState<PosterSupplier[]>([]);
    const [supplies, setSupplies] = useState<Supply[]>([]);
    const [suppliesError, setSuppliesError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    const firestore = useFirestore();
    const ingredientsQuery = useMemoFirebase(() => {
        if (!firestore || !orgId) return null;
        return query(collection(firestore, 'organizations', orgId, 'erp_items'), orderBy('name', 'asc'));
    }, [firestore, orgId]);

    const suppliersQuery = useMemoFirebase(() => {
        if (!firestore || !orgId) return null;
        return query(collection(firestore, 'organizations', orgId, 'suppliers'), orderBy('name', 'asc'));
    }, [firestore, orgId]);

    const { data: ingredients, isLoading: ingredientsLoading } = useCollection<ERPItem>(ingredientsQuery, { once: true });
    const { data: suppliers, isLoading: suppliersLoading } = useCollection<Supplier>(suppliersQuery, { once: true });

    useEffect(() => {
        if (!orgId) return;

        const fetchAll = async () => {
            const [storagesData, suppliersData, suppliesResult] = await Promise.allSettled([
                fetchStoragesAction(orgId),
                fetchSuppliersAction(orgId),
                fetchSuppliesAction(orgId),
            ]);

            if (storagesData.status === 'fulfilled') setStorages(storagesData.value);
            if (suppliersData.status === 'fulfilled') setPosterSuppliers(suppliersData.value);
            if (suppliesResult.status === 'fulfilled') {
                setSupplies(suppliesResult.value.data ?? []);
                setSuppliesError(suppliesResult.value.error ?? null);
            }
        };

        fetchAll();
    }, [orgId]);

    useEffect(() => {
        if (!ingredientsLoading && !suppliersLoading) {
            setLoading(false);
        }
    }, [ingredientsLoading, suppliersLoading]);

    const getStatusVariant = (status: string) => {
        switch (status) {
        case '1': return 'secondary';
        case '2': return 'default';
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
                storages={storages}
                suppliers={posterSuppliers}
            />
        
            <Card>
                <CardHeader>
                    <CardTitle>Последние поставки</CardTitle>
                    <CardDescription>Список недавних поставок, полученных из Poster.</CardDescription>
                </CardHeader>
                <CardContent>
                    {suppliesError ? (
                        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                            <div>
                                <p className="font-medium">Не удалось загрузить поставки</p>
                                <p className="text-xs mt-1 text-amber-700">{suppliesError}</p>
                            </div>
                        </div>
                    ) : (
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
                                {supplies.length > 0 ? (
                                    supplies.map((supply) => (
                                        <TableRow key={supply.supply_id}>
                                            <TableCell className="font-medium">
                                              {supply.supply_id}
                                              {supply.comment?.includes('[FLOW]') && (
                                                  <Badge variant="outline" className="ml-2 bg-blue-50 text-blue-600 border-blue-200 text-[8px] uppercase font-black tracking-widest px-1 py-0 shadow-none">FLOW</Badge>
                                              )}
                                            </TableCell>
                                            <TableCell>{supply.date_created ? format(new Date(supply.date_created.replace(' ', 'T')), 'dd.MM.yyyy HH:mm') : '-'}</TableCell>
                                            <TableCell>{supply.supplier_name || '-'}</TableCell>
                                            <TableCell className="text-right font-black">
                                              {(Number(supply.supply_sum) / 100).toLocaleString()} <span className="text-[10px] text-muted-foreground uppercase">сум</span>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant={getStatusVariant(supply.supply_status)}>
                                                    {getStatusLabel(supply.supply_status)}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-xs text-slate-500">
                                                {(() => {
                                                    if (!supply.comment) return '-';
                                                    if (supply.comment.toUpperCase().includes('FLOW')) {
                                                        return (
                                                            <div className="flex flex-col gap-1 items-start">
                                                              <span>{supply.comment}</span>
                                                              <Link href="/payable">
                                                                <Badge variant="secondary" className="hover:bg-primary/20 hover:text-primary transition-colors cursor-pointer text-[10px] uppercase font-bold text-blue-600 bg-blue-50 border-blue-200 shadow-sm mt-1">
                                                                  Сверка во Взаиморасчетах ➔
                                                                </Badge>
                                                              </Link>
                                                            </div>
                                                        );
                                                    }
                                                    return supply.comment;
                                                })()}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                                            Поставок не найдено.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
