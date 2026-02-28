'use client';

import React, { useState, useEffect } from 'react';
import { WriteOffsPageHeader } from '@/components/write-offs/write-offs-page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { type LocalIngredient } from '@/app/ingredients/actions';
import { Skeleton } from '@/components/ui/skeleton';
import { useCollection, useFirestore } from '@/firebase/hooks';
import { useMemoFirebase } from '@/firebase/provider';
import { collection, query, orderBy } from 'firebase/firestore';

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


export function WriteOffsPageClient() {
    const [loading, setLoading] = useState(true);

    const firestore = useFirestore();
    const ingredientsQuery = useMemoFirebase(() => 
        firestore 
            ? query(collection(firestore, 'ingredients_master'), orderBy('name', 'asc'))
            : null
    , [firestore]);

    const { data: ingredients, isLoading: ingredientsLoading } = useCollection<LocalIngredient>(ingredientsQuery);

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
        
            <Card>
                <CardHeader>
                    <CardTitle>Последние списания</CardTitle>
                    <CardDescription>Список недавних списаний будет отображаться здесь.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="h-24 flex items-center justify-center text-muted-foreground">
                        Нет данных о списаниях.
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
