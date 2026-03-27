'use client';

import { useUser, useDoc, useFirestore } from '@/firebase/hooks';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Header } from '@/components/layout/header';
import { Loader2 } from 'lucide-react';
import { doc } from 'firebase/firestore';
import { useMemoFirebase } from '@/firebase/provider';
import { EmployeeLayout } from '../layout/employee-layout';
import { UserRole } from '@/lib/types/erp';

const publicPaths = ['/login', '/register'];

type UserProfile = {
    role: UserRole;
    locationIds?: string[];
};

export function AuthGuard({ children }: { children: React.ReactNode }) {
    const { user, loading: userLoading } = useUser();
    const firestore = useFirestore();
    const router = useRouter();
    const pathname = usePathname();
    
    const userProfileRef = useMemoFirebase(() => {
        if (!firestore || !user?.uid) return null;
        return doc(firestore, 'users', user.uid);
    }, [firestore, user?.uid]);

    const { data: userProfile, isLoading: profileLoading } = useDoc<UserProfile>(userProfileRef);

    const isLoading = userLoading || (user && profileLoading);

    useEffect(() => {
        if (isLoading) {
            return; // Wait until loading is complete
        }

        const isPublicPath = publicPaths.includes(pathname);

        // If user is not logged in and not on a public path, redirect to login
        if (!user && !isPublicPath) {
            router.push('/login');
        }

        // If user is logged in and on a public path, redirect to the main page
        if (user && isPublicPath) {
            router.push('/supplies');
        }
    }, [user, isLoading, router, pathname]);

    // While loading, show a full-page loader
    if (isLoading) {
        return (
            <div className="flex min-h-screen w-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }
    
    // If user is not logged in and not on a public path, render loader until redirect completes
    if (!user && !publicPaths.includes(pathname)) {
        return (
            <div className="flex min-h-screen w-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }

    // If user is logged in, or on a public path, render the layout
    if (user || publicPaths.includes(pathname)) {
         if (publicPaths.includes(pathname)) {
            return <>{children}</>;
         }
         
         const role = userProfile?.role;

         // Roles that use the standard Admin Layout with Header
         if (role === 'SUPER_ADMIN' || role === 'MANAGER') {
            return (
                <div className="flex min-h-screen w-full flex-col bg-muted/40">
                  <Header />
                  <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-6">
                    {children}
                  </main>
                </div>
            );
         }

         // Roles that use the simplified Employee Layout (staff or kitchen)
         if (role === 'STAFF_POINT' || role === 'KITCHEN' || !role) {
            return <EmployeeLayout>{children}</EmployeeLayout>;
         }
    }

    return (
        <div className="flex min-h-screen w-full items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin" />
        </div>
    );
}
