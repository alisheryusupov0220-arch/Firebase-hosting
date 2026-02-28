'use client';

import React, { useState, useTransition } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { syncIngredientsAction } from './actions';
import { useCollection } from '@/firebase/hooks';
import { collection, query, orderBy } from 'firebase/firestore';
import { useFirestore, useMemoFirebase } from '@/firebase/provider';
import { RefreshCw } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default function IngredientsPage() {
    const { toast } = useToast();
    const [isSyncing, startSyncTransition] = useTransition();
    
    const firestore = useFirestore();

    const ingredientsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'ingredients_master'), orderBy('name', 'asc'));
    }, [firestore]);

    const { data: ingredients, isLoading, error } = useCollection(ingredientsQuery);

    const handleSync = () => {
        startSyncTransition(async () => {
            const result = await syncIngredientsAction();
            if (result.success) {
                toast({
                    title: 'Синхронизация завершена',
                    description: `Загружено и обновлено ${result.count} позиций.`,
                });
            } else {
                toast({
                    variant: 'destructive',
                    title: 'Ошибка синхронизации',
                    description: result.message,
                });
            }
        });
    };

    return (
        <div className="space-y-6">
            <div className="flex items-start justify-between">
                <PageHeader 
                    title="Справочник ингредиентов" 
                    description="Локальная база ингредиентов, синхронизированная с Poster."
                />
                <Button onClick={handleSync} disabled={isSyncing}>
                    <RefreshCw className={`mr-2 h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
                    {isSyncing ? 'Синхронизация...' : 'Синхронизировать с Poster'}
                </Button>
            </div>
            
            <Card>
                <CardHeader>
                    <CardTitle>Ингредиенты</CardTitle>
                    <CardDescription>
                        Список всех ингредиентов и полуфабрикатов, используемых в поставках и списаниях.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Название</TableHead>
                                <TableHead>Ед. изм.</TableHead>
                                <TableHead>Тип</TableHead>
                                <TableHead className="text-right">ID в Poster</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading && (
                                <TableRow>
                                    <TableCell colSpan={4} className="h-24 text-center">
                                        Загрузка...
                                    </TableCell>
                                </TableRow>
                            )}
                            {error && (
                                <TableRow>
                                    <TableCell colSpan={4} className="h-24 text-center text-destructive">
                                        Ошибка загрузки: {error.message}
                                    </TableCell>
                                </TableRow>
                            )}
                            {!isLoading && !error && ingredients?.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={4} className="h-24 text-center">
                                        Ингредиенты не найдены. Попробуйте синхронизировать данные.
                                    </TableCell>
                                </TableRow>
                            )}
                            {ingredients?.map((ing) => (
                                <TableRow key={ing.id}>
                                    <TableCell className="font-medium">{ing.name}</TableCell>
                                    <TableCell>{ing.unit || '-'}</TableCell>
                                    <TableCell className="text-muted-foreground">{ing.type}</TableCell>
                                    <TableCell className="text-right text-muted-foreground">{ing.id}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
