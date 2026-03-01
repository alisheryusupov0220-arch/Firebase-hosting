'use client';

import { useUser, useDoc, useFirestore, useAuth } from '@/firebase/hooks';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Header } from '@/components/layout/header';
import { Loader2 } from 'lucide-react';
import { doc, getDocs, query, collection, where, limit } from 'firebase/firestore';
import { useMemoFirebase } from '@/firebase/provider';
import { EmployeeLayout } from '../layout/employee-layout';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { getUsersAction } from '@/app/settings/actions';

const publicPaths = ['/login', '/register'];

type UserProfile = {
    role: 'admin' | 'employee';
};

export function AuthGuard({ children }: { children: React.ReactNode }) {
    const { user, loading: userLoading } = useUser();
    const firestore = useFirestore();
    const auth = useAuth();
    const router = useRouter();
    const pathname = usePathname();
    const [isTelegramAuthAttempted, setIsTelegramAuthAttempted] = useState(false);

    // New effect for Telegram auto-login
    useEffect(() => {
        if (user || !auth || !firestore || typeof window === 'undefined') {
            if(user) {
                setIsTelegramAuthAttempted(true);
            }
            return;
        }

        const tg = (window as any).Telegram?.WebApp;
        if (tg && tg.initData) {
            try {
                tg.ready();
                const tgUser = tg.initDataUnsafe?.user;

                if (tgUser && tgUser.id) {
                    const telegramId = String(tgUser.id);

                    const loginWithTelegram = async () => {
                        try {
                            const allUsers = await getUsersAction();
                            const userProfile = allUsers.find(u => u.telegramId === telegramId);
                    
                            if (!userProfile || !userProfile.email) {
                                console.log(`No user found for Telegram ID: ${telegramId} or user has no email.`);
                                setIsTelegramAuthAttempted(true);
                                return;
                            }

                            const email = userProfile.email;
                            const password = `tg_pass_${telegramId}_secret`;

                            await signInWithEmailAndPassword(auth, email, password);
                            // onAuthStateChanged in useUser will update the state
                        } catch (error) {
                            console.error("Telegram auto-login failed:", error);
                            setIsTelegramAuthAttempted(true);
                        }
                    };

                    loginWithTelegram();
                } else {
                    setIsTelegramAuthAttempted(true);
                }
            } catch (error) {
                console.error("Error initializing Telegram WebApp:", error);
                setIsTelegramAuthAttempted(true);
            }
        } else {
            setIsTelegramAuthAttempted(true);
        }
    }, [auth, firestore, user]);


    const userProfileRef = useMemoFirebase(() => {
        if (!firestore || !user?.uid) return null;
        return doc(firestore, 'users', user.uid);
    }, [firestore, user?.uid]);

    const { data: userProfile, isLoading: profileLoading } = useDoc<UserProfile>(userProfileRef);

    const isLoading = userLoading || (user && profileLoading) || !isTelegramAuthAttempted;

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
         
         if (userProfile?.role === 'employee') {
            return <EmployeeLayout>{children}</EmployeeLayout>;
         }

         if (userProfile?.role === 'admin') {
            return (
                <div className="flex min-h-screen w-full flex-col bg-muted/40">
                  <Header />
                  <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-6">
                    {children}
                  </main>
                </div>
            );
         }
    }

    return (
        <div className="flex min-h-screen w-full items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin" />
        </div>
    );
}
