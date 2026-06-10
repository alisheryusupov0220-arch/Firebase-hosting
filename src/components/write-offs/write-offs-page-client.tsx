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
import { type ERPItem } from '@/lib/types/erp';
import { Skeleton } from '@/components/ui/skeleton';
import { useCollection, useFirestore } from '@/firebase/hooks';
import { useMemoFirebase, useFirebase } from '@/firebase/provider';
import { collection, query, orderBy } from 'firebase/firestore';
import { getWastes, type Waste } from '@/lib/poster';
import { AlertCircle } from 'lucide-react';

type WriteOffsPageClientProps = {
    initialWastes?: Waste[];
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


export function WriteOffsPageClient({ initialWastes = [] }: WriteOffsPageClientProps) {
    const { orgId } = useFirebase();
    const [wastes, setWastes] = useState<Waste[]>(initialWastes);
    const [wastesError, setWastesError] = useState<string | null>(null);
    const [wastesLoading, setWastesLoading] = useState(true);
    const [loading, setLoading] = useState(true);

    const firestore = useFirestore();

    const ingredientsQuery = useMemoFirebase(() => 
        (firestore && orgId)
            ? query(collection(firestore, 'organizations', orgId, 'erp_items'), orderBy('name', 'asc'))
            : null
    , [firestore, orgId]);

    const { data: ingredients, isLoading: ingredientsLoading } = useCollection<ERPItem>(ingredientsQuery);

    useEffect(() => {
        if (!ingredientsLoading) {
            setLoading(false);
        }
    }, [ingredientsLoading]);

    useEffect(() => {
        if (!orgId) {
            setWastesLoading(false);
            return;
        }

        const fetchWastes = async () => {
            setWastesLoading(true);
            setWastesError(null);
            try {
                const data = await getWastes(orgId);
                setWastes(data);
            } catch (e) {
                const message = e instanceof Error ? e.message : 'Не удалось загрузить списания.';
                setWastesError(message);
            } finally {
                setWastesLoading(false);
            }
        };

        fetchWastes();
    }, [orgId]);
    
    if (loading || wastesLoading) {
        return <PageSkeleton />;
    }

    return (
        <div className="space-y-8">
            <WriteOffsPageHeader
                ingredients={ingredients}
            />
        
            <Card>
                <CardHeader>
                    <CardTitle>Последние списания</CardTitle>
                    <CardDescription>Список недавних списаний, полученных из Poster.</CardDescription>
                </CardHeader>
                <CardContent>
                    {wastesError ? (
                        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                            <div>
                                <p className="font-medium">Не удалось загрузить списания</p>
                                <p className="text-xs mt-1 text-amber-700">{wastesError}</p>
                            </div>
                        </div>
                    ) : (
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
                                {wastes.length > 0 ? (
                                    wastes.map((waste) => (
                                        <TableRow key={waste.waste_id}>
                                            <TableCell className="font-medium">{waste.waste_id}</TableCell>
                                            <TableCell>{waste.date ? format(new Date(waste.date.replace(' ', 'T')), 'dd.MM.yyyy HH:mm') : '-'}</TableCell>
                                            <TableCell>{waste.reason_name || '-'}</TableCell>
                                            <TableCell className="text-right">{new Intl.NumberFormat('uz-UZ', { style: 'currency', currency: 'UZS', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Number(waste.total_sum) / 100)}</TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={4} className="h-24 text-center">
                                            Списаний не найдено.
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
