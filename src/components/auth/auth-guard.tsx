'use client';

import { useUser } from '@/firebase/hooks';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Header } from '@/components/layout/header';
import { Loader2 } from 'lucide-react';

const publicPaths = ['/login', '/register'];

export function AuthGuard({ children }: { children: React.ReactNode }) {
    const { user, loading } = useUser();
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        if (loading) {
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
    }, [user, loading, router, pathname]);

    // While loading, show a full-page loader
    if (loading) {
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

         return (
            <div className="flex min-h-screen w-full flex-col bg-muted/40">
              <Header />
              <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-6">
                {children}
              </main>
            </div>
        );
    }

    return null;
}
