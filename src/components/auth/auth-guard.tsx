'use client';

import { useUser, useDoc, useFirestore, useFirebase } from '@/firebase/hooks';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Header } from '@/components/layout/header';
import { Loader2 } from 'lucide-react';
import { doc } from 'firebase/firestore';
import { useMemoFirebase } from '@/firebase/provider';
import { EmployeeLayout } from '../layout/employee-layout';
import { UserRole } from '@/lib/types/erp';
import { Sidebar } from '../layout/sidebar';
import { MobileBottomNav } from '../layout/mobile-bottom-nav';

const publicPaths = ['/login', '/register'];

type UserProfile = {
    role: UserRole;
    locationIds?: string[];
};

// Route permissions mapping
const routePermissions: Record<string, string[]> = {
  '/supplies': ['super_admin', 'brand_admin', 'outlet_admin', 'employee'],
  '/supplies/reception': ['super_admin', 'brand_admin', 'outlet_admin', 'employee', 'tablet'],
  '/orders': ['super_admin', 'brand_admin', 'outlet_admin', 'employee', 'cashier'],
  '/write-offs': ['super_admin', 'brand_admin', 'outlet_admin', 'employee', 'cashier', 'tablet'],
  '/finance-hub': ['super_admin', 'brand_admin'],
  '/transfers': ['super_admin', 'brand_admin', 'outlet_admin'],
  '/inventory': ['super_admin', 'brand_admin', 'outlet_admin', 'employee', 'cashier'],
  '/menu-analytics': ['super_admin', 'brand_admin'],
  '/super-admin': ['super_admin'],
  '/sandbox': ['super_admin'],
  '/ingredients': ['super_admin', 'brand_admin', 'outlet_admin', 'employee'],
  '/settings': ['super_admin', 'brand_admin', 'outlet_admin', 'employee', 'cashier', 'tablet'],
};

// Helper to determine default landing page by role
const getDefaultPathForRole = (role: string): string => {
  if (role === 'super_admin') return '/super-admin';
  if (role === 'cashier') return '/orders';
  if (role === 'tablet') return '/supplies/reception';
  return '/supplies';
};

// Helper to check if a route is allowed for a given role
const isPathAllowed = (path: string, role: string): boolean => {
  return true; // Always allow all routes without restrictions
};

export function AuthGuard({ children }: { children: React.ReactNode }) {
    const { user, loading: userLoading } = useUser();
    const firestore = useFirestore();
    const router = useRouter();
    const pathname = usePathname();
    const firebase = useFirebase();
    const claimsRole = firebase?.role;
    const claimsOrgId = firebase?.orgId;
    
    const userProfileRef = useMemoFirebase(() => {
        if (!firestore || !user?.uid) return null;
        return doc(firestore, 'users', user.uid);
    }, [firestore, user?.uid]);

    const { data: userProfile, isLoading: profileLoading } = useDoc<UserProfile>(userProfileRef, { once: true });

    // Block initial render while auth state OR user profile (for roles) is initializing
    const isLoading = userLoading || (!!user && profileLoading);

    // Real-time self-healing claims check
    useEffect(() => {
        const healClaims = async () => {
            if (user && (!claimsRole || (!claimsOrgId && claimsRole !== 'super_admin'))) {
                // Предотвращаем бесконечный цикл перезагрузки с помощью параметра в URL (безопасно для iframe/WebView)
                if (typeof window !== 'undefined') {
                    const url = new URL(window.location.href);
                    if (url.searchParams.get('healed') === '1') {
                        console.warn('Self-healing claims: already reloaded once. Aborting reload loop.');
                        return;
                    }
                }

                try {
                    const idToken = await user.getIdToken();
                    const res = await fetch('/api/auth/sync-claims', {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${idToken}` }
                    });
                    if (res.ok) {
                        await user.getIdToken(true); // force JWT refresh
                        
                        if (typeof window !== 'undefined') {
                            const url = new URL(window.location.href);
                            url.searchParams.set('healed', '1');
                            
                            // Задержка перед перезагрузкой, чтобы Firebase SDK успел записать токен в кэш
                            setTimeout(() => {
                                window.location.replace(url.toString());
                            }, 800);
                        }
                    }
                } catch (e) {
                    console.error('Self-healing claims sync failed:', e);
                }
            }
        };
        healClaims();
    }, [user, claimsRole, claimsOrgId]);


    useEffect(() => {
        if (isLoading) {
            return; // Wait until loading is complete
        }

        const isPublicPath = publicPaths.includes(pathname);

        // If user is not logged in and not on a public path, redirect to login
        if (!user && !isPublicPath) {
            router.push('/login');
            return;
        }

        // If user is logged in and on a public path, redirect to the default route
        if (user && isPublicPath) {
            const role = (userProfile?.role as string || '').toLowerCase();
            router.push(getDefaultPathForRole(role));
            return;
        }

        // If user is logged in, verify if they are allowed on the current path
        if (user && !isPublicPath) {
            const role = (userProfile?.role as string || '').toLowerCase();
            if (!isPathAllowed(pathname, role)) {
                router.push(getDefaultPathForRole(role));
            }
        }
    }, [user, isLoading, router, pathname, userProfile]);

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
         
         const role = (userProfile?.role as string || '').toLowerCase();

         // Roles that use the standard Admin Layout with Sidebar
         if (role === 'super_admin' || role === 'brand_admin' || role === 'outlet_admin' || role === 'manager') {
            return (
                <div className="flex min-h-screen w-full bg-background">
                  <Sidebar />
                  <div className="flex flex-1 flex-col md:pl-64">
                    <div className="md:hidden">
                      <Header />
                    </div>
                    <main className="flex-1 p-4 pb-28 md:pb-8 md:p-8 lg:p-10 animate-in fade-in zoom-in-95 duration-500">
                      {children}
                    </main>
                    <div className="md:hidden">
                      <MobileBottomNav />
                    </div>
                  </div>
                </div>
            );
         }

         // Roles that use the simplified Employee Layout (staff or kitchen)
         if (role === 'employee' || role === 'cashier' || role === 'staff_point' || role === 'kitchen' || role === 'tablet' || !role) {
            return <EmployeeLayout>{children}</EmployeeLayout>;
         }
    }

    return (
        <div className="flex min-h-screen w-full items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin" />
        </div>
    );
}
