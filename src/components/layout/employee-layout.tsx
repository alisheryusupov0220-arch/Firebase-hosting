'use client';

import React, { useState, useEffect } from 'react';
import { MobileBottomNav } from './mobile-bottom-nav';
import { FabMenu } from './fab-menu';
import { useCollection, useFirestore } from '@/firebase/hooks';
import { useMemoFirebase } from '@/firebase/provider';
import { collection, orderBy, query } from 'firebase/firestore';
import type { LocalIngredient } from '@/app/ingredients/actions';
import { fetchStoragesAction, fetchSuppliersAction } from '@/app/supplies/actions';
import type { Storage, PosterSupplier } from '@/lib/poster';

export function EmployeeLayout({ children }: { children: React.ReactNode }) {
    const firestore = useFirestore();
    const [storages, setStorages] = useState<Storage[]>([]);
    const [suppliers, setSuppliers] = useState<PosterSupplier[]>([]);

    const ingredientsQuery = useMemoFirebase(() => 
        firestore 
            ? query(collection(firestore, 'ingredients_master'), orderBy('name', 'asc'))
            : null
    , [firestore]);

    const { data: ingredients } = useCollection<LocalIngredient>(ingredientsQuery);

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

    return (
        <div className="flex min-h-screen w-full flex-col bg-background">
            <main className="flex-1 p-4 pb-32">
                {children}
            </main>
            <FabMenu
              ingredients={ingredients}
              storages={storages}
              suppliers={suppliers}
            />
            <MobileBottomNav />
        </div>
    );
}
