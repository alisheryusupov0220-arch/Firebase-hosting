'use client';

import React, { useState, useEffect } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { ReceptionClient } from '@/components/supplies/reception-client';
import { fetchStoragesAction, fetchSuppliersAction } from '@/app/supplies/actions';
import { type Storage, type PosterSupplier } from '@/lib/poster';
import { useFirebase } from '@/firebase/provider';
import { Skeleton } from '@/components/ui/skeleton';

export default function ReceptionPage() {
    const { orgId: ctxOrgId } = useFirebase();
    const orgId = ctxOrgId || 'default';
    const [storages, setStorages] = useState<Storage[]>([]);
    const [suppliers, setSuppliers] = useState<PosterSupplier[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadAll = async () => {
            try {
                const targetOrgId = orgId !== 'default' ? orgId : undefined;
                const [storagesData, suppliersData] = await Promise.all([
                    fetchStoragesAction(targetOrgId),
                    fetchSuppliersAction(targetOrgId)
                ]);
                setStorages(storagesData || []);
                setSuppliers(suppliersData || []);
            } catch (e) {
                console.error('Failed to load initial reception data:', e);
            } finally {
                setLoading(false);
            }
        };

        loadAll();
    }, [orgId]);

    if (loading) {
        return (
            <div className="space-y-6 max-w-3xl mx-auto p-4">
                <Skeleton className="h-10 w-48" />
                <Skeleton className="h-4 w-72 mt-2" />
                <Skeleton className="h-64 w-full rounded-[2rem] mt-6" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <PageHeader 
                title="Приемка по фото" 
                description="Оцифровка накладной через камеру планшета и сверка фактического количества."
            />
            <ReceptionClient 
                storages={storages}
                suppliers={suppliers}
            />
        </div>
    );
}
