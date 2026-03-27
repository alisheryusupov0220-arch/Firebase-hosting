'use client';

import React, { useTransition } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { syncSuppliersFromPosterAction } from '../actions/flow-core';
import { useCollection } from '@/firebase/hooks';
import { collection, query, orderBy } from 'firebase/firestore';
import { useFirestore, useMemoFirebase } from '@/firebase/provider';
import { RefreshCw, Users } from 'lucide-react';
import { Supplier } from '@/lib/types/erp';
import { cn } from '@/lib/utils';

export default function SuppliersPage() {
    const { toast } = useToast();
    const [isSyncing, startSyncTransition] = useTransition();
    
    const firestore = useFirestore();

    const suppliersQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'suppliers'), orderBy('name', 'asc'));
    }, [firestore]);

    const { data: suppliers, isLoading, error } = useCollection<Supplier>(suppliersQuery);

    const handleSync = () => {
        startSyncTransition(async () => {
            const result = await syncSuppliersFromPosterAction();
            if (result.success) {
                toast({
                    title: 'Поставщики обновлены',
                    description: `Синхронизировано ${result.count} поставщиков из Poster.`,
                });
            } else {
                toast({
                    variant: 'destructive',
                    title: 'Ошибка',
                    description: result.message,
                });
            }
        });
    };

    return (
        <div className="space-y-6">
            <div className="flex items-start justify-between">
                <PageHeader 
                    title="База поставщиков FLOW" 
                    description="Управление поставщиками и их связью с Poster API."
                />
                <Button onClick={handleSync} disabled={isSyncing}>
                    <RefreshCw className={`mr-2 h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
                    Обновить из Poster
                </Button>
            </div>
            
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Users className="h-5 w-5" />
                        Активные поставщики
                    </CardTitle>
                    <CardDescription>
                        Список поставщиков, у которых проводятся закупки.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Название</TableHead>
                                <TableHead>Баланс (Долг)</TableHead>
                                <TableHead>Статус</TableHead>
                                <TableHead className="text-right">Poster ID</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading && (
                                <TableRow>
                                    <TableCell colSpan={3} className="h-24 text-center">Загрузка...</TableCell>
                                </TableRow>
                            )}
                            {!isLoading && suppliers?.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                                        Список пуст.
                                    </TableCell>
                                </TableRow>
                            )}
                            {suppliers?.map((s) => (
                                <TableRow key={s.id}>
                                    <TableCell className="font-medium">{s.name}</TableCell>
                                    <TableCell className={cn("font-mono", (s.balance || 0) > 0 ? "text-destructive" : "text-green-600")}>
                                        {new Intl.NumberFormat('uz-UZ', { style: 'currency', currency: 'UZS', minimumFractionDigits: 0 }).format((s.balance || 0) / 100)}
                                    </TableCell>
                                    <TableCell>
                                        {s.isActive ? (
                                            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">Активен</span>
                                        ) : (
                                            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">Неактивен</span>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right text-muted-foreground tabular-nums">
                                        {s.posterId || '—'}
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
