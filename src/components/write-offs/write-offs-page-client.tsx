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
import { format } from 'date-fns';
import { WriteOffsPageHeader } from '@/components/write-offs/write-offs-page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { type LocalIngredient } from '@/app/ingredients/actions';
import { Skeleton } from '@/components/ui/skeleton';
import { useCollection, useFirestore, useUser, useDoc } from '@/firebase/hooks';
import { useMemoFirebase } from '@/firebase/provider';
import { collection, query, orderBy, doc } from 'firebase/firestore';
import type { Waste, Storage } from '@/lib/poster';
import { PendingWriteOffsCard } from './pending-write-offs-card';
import { fetchStoragesAction } from '@/app/write-offs/actions';

type WriteOffsPageClientProps = {
    initialWastes: Waste[];
    comments: Record<string, string>;
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
                <div className="h-24 flex items-center justify-center text-muted-foreground">
                    Загрузка...
                </div>
            </CardContent>
        </Card>
    </div>
);


export function WriteOffsPageClient({ initialWastes, comments }: WriteOffsPageClientProps) {
    const [storages, setStorages] = useState<Storage[]>([]);
    const [loading, setLoading] = useState(true);

    const { user } = useUser();
    const firestore = useFirestore();

    const userProfileRef = useMemoFirebase(() => {
        if (!firestore || !user?.uid) return null;
        return doc(firestore, 'users', user.uid);
    }, [firestore, user?.uid]);
    const { data: userProfile } = useDoc(userProfileRef);

    const ingredientsQuery = useMemoFirebase(() => 
        firestore 
            ? query(collection(firestore, 'ingredients_master'), orderBy('name', 'asc'))
            : null
    , [firestore]);

    const { data: ingredients, isLoading: ingredientsLoading } = useCollection<LocalIngredient>(ingredientsQuery);

    useEffect(() => {
        const fetchDropdownData = async () => {
            const storagesData = await fetchStoragesAction();
            setStorages(storagesData);
        };
        fetchDropdownData();
    }, []);


    useEffect(() => {
        if (!ingredientsLoading) {
            setLoading(false);
        }
    }, [ingredientsLoading]);
    
    if (loading) {
        return <PageSkeleton />;
    }

    return (
        <div className="space-y-8">
            <WriteOffsPageHeader
                ingredients={ingredients}
            />

            {userProfile?.role === 'admin' && (
                <PendingWriteOffsCard 
                    storages={storages}
                    ingredients={ingredients || []}
                />
            )}
        
            <Card>
                <CardHeader>
                    <CardTitle>Последние списания</CardTitle>
                    <CardDescription>Список недавних списаний, полученных из Poster.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[100px]">ID</TableHead>
                                <TableHead>Дата</TableHead>
                                <TableHead>Причина</TableHead>
                                <TableHead className="text-right">Сумма</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {initialWastes.length > 0 ? (
                                initialWastes.map((waste) => {
                                    const firestoreComment = comments[waste.waste_id];
                                    const displayReason = firestoreComment || waste.reason_name;
                                    
                                    return (
                                        <TableRow key={waste.waste_id}>
                                            <TableCell className="font-medium">{waste.waste_id}</TableCell>
                                            <TableCell>{waste.date ? format(new Date(waste.date.replace(' ', 'T')), 'dd.MM.yyyy HH:mm') : '-'}</TableCell>
                                            <TableCell>{displayReason || '-'}</TableCell>
                                            <TableCell className="text-right">{new Intl.NumberFormat('uz-UZ', { style: 'currency', currency: 'UZS', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Number(waste.total_sum) / 100)}</TableCell>
                                        </TableRow>
                                    );
                                })
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={4} className="h-24 text-center">
                                        Списаний не найдено.
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
