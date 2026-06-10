'use client';

import React from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { CreateStaffOrderForm } from '@/components/orders/create-staff-order-form';
import { useCollection, useFirestore } from '@/firebase/hooks';
import { collection, query, orderBy } from 'firebase/firestore';
import { useMemoFirebase, useFirebase } from '@/firebase/provider';
import { Supplier, SupplierItem } from '@/lib/types/erp';
import { RefreshCw, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function CreateOrderPage() {
    const firestore = useFirestore();
    const { orgId } = useFirebase();

    const suppliersQuery = useMemoFirebase(() => {
        if (!firestore || !orgId) return null;
        return query(collection(firestore, 'organizations', orgId, 'suppliers'), orderBy('name', 'asc'));
    }, [firestore, orgId]);

    const supplierItemsQuery = useMemoFirebase(() => {
        if (!firestore || !orgId) return null;
        return query(collection(firestore, 'organizations', orgId, 'contractor_items'));
    }, [firestore, orgId]);

    const { data: suppliers, isLoading: sLoading } = useCollection<Supplier>(suppliersQuery);
    const { data: sItems, isLoading: siLoading } = useCollection<SupplierItem>(supplierItemsQuery as any);

    const locations = [
        { id: '1', name: 'Основной Склад' },
        { id: '2', name: 'Кухня (Master)' },
        { id: '3', name: 'Бар (Point)' },
    ];

    if (sLoading || siLoading) {
        return (
            <div className="h-[60vh] flex flex-col items-center justify-center space-y-4">
                <RefreshCw className="h-10 w-10 animate-spin text-primary/30" />
                <p className="text-sm font-black uppercase tracking-widest text-slate-400">Загрузка данных для закупа...</p>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" asChild className="rounded-2xl">
                    <Link href="/orders"><ArrowLeft className="h-6 w-6" /></Link>
                </Button>
                <PageHeader 
                    title="Формирование заявки" 
                    description="Идите по списку, пересчитывайте факт и подтверждайте заказ."
                />
            </div>

            <CreateStaffOrderForm 
                allSuppliers={suppliers || []}
                allSupplierItems={sItems || []}
                allLocations={locations}
            />
        </div>
    );
}
