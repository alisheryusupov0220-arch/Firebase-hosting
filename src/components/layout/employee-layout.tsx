'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { signOut } from 'firebase/auth';
import { MobileBottomNav } from './mobile-bottom-nav';
import { FabMenu } from './fab-menu';
import { useCollection, useFirestore } from '@/firebase/hooks';
import { useMemoFirebase, useFirebase } from '@/firebase/provider';
import { collection, orderBy, query } from 'firebase/firestore';
import { type ERPItem } from '@/lib/types/erp';
import { fetchStoragesAction, fetchSuppliersAction } from '@/app/supplies/actions';
import type { Storage, PosterSupplier } from '@/lib/poster';
import { Button } from '@/components/ui/button';
import { LogOut, Package2 } from 'lucide-react';

export function EmployeeLayout({ children }: { children: React.ReactNode }) {
    const firestore = useFirestore();
    const router = useRouter();
    const { auth, user, role, orgId } = useFirebase();
    const [storages, setStorages] = useState<Storage[]>([]);
    const [suppliers, setSuppliers] = useState<PosterSupplier[]>([]);

    const ingredientsQuery = useMemoFirebase(() => 
        (firestore && orgId)
            ? query(collection(firestore, 'organizations', orgId, 'erp_items'), orderBy('name', 'asc'))
            : null
    , [firestore, orgId]);

    const { data: ingredients } = useCollection<ERPItem>(ingredientsQuery);

    useEffect(() => {
        const fetchDropdownData = async () => {
            if (!orgId) return;
            const [storagesData, suppliersData] = await Promise.all([
                fetchStoragesAction(orgId),
                fetchSuppliersAction(orgId),
            ]);
            setStorages(storagesData);
            setSuppliers(suppliersData);
        };
        fetchDropdownData();
    }, [orgId]);

    const handleSignOut = async () => {
        if (auth) {
            await signOut(auth);
            router.push('/login');
        }
    };

    return (
        <div className="flex min-h-screen w-full flex-col bg-background">
            {/* Top Header for Employee / Mobile Views */}
            <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b bg-card px-4 shadow-sm">
                <div className="flex items-center gap-2 font-headline text-md font-bold text-primary">
                    <Package2 className="h-5 w-5" />
                    <span>FLOW <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60">Invent+</span></span>
                </div>
                <div className="flex items-center gap-3">
                    {user && (
                        <div className="flex flex-col items-end leading-none text-right">
                            <span className="text-xs font-semibold text-foreground truncate max-w-[150px]">
                                {user.displayName || user.email?.split('@')[0]}
                            </span>
                            <span className="text-[9px] text-muted-foreground capitalize">
                                {(role || 'employee').replace('_', ' ')}
                            </span>
                        </div>
                    )}
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={handleSignOut} 
                        className="h-8 gap-1.5 px-2.5 text-destructive hover:text-destructive hover:bg-destructive/10 rounded-xl"
                    >
                        <LogOut className="h-3.5 w-3.5" />
                        <span className="text-xs font-medium">Выйти</span>
                    </Button>
                </div>
            </header>

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
