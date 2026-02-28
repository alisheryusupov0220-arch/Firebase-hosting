'use client';

import React, { useState, useEffect } from 'react';
import { WriteOffsPageHeader } from '@/components/write-offs/write-offs-page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getLocalIngredients, type LocalIngredient } from '@/app/ingredients/actions';
import { fetchStoragesAction } from '@/app/write-offs/actions';
import type { Storage } from '@/lib/poster';
import { Skeleton } from '@/components/ui/skeleton';

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
    const [storages, setStorages] = useState<Storage[]>([]);
    const [ingredients, setIngredients] = useState<LocalIngredient[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            const [storagesData, ingredientsData] = await Promise.all([
                fetchStoragesAction(),
                getLocalIngredients(),
            ]);
            setStorages(storagesData);
            setIngredients(ingredientsData);
            setLoading(false);
        };
        fetchData();
    }, []);

    const ingredientsForForm = ingredients.map(ing => ({
      ingredient_id: ing.id,
      ingredient_name: ing.name,
      ingredient_unit: ing.unit,
    }));
    
    if (loading) {
        return <PageSkeleton />;
    }

    return (
        <div className="space-y-8">
            <WriteOffsPageHeader
                storages={storages}
                ingredients={ingredientsForForm}
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
