'use client';

import { useUser, useDoc, useFirestore, useAuth } from '@/firebase/hooks';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Header } from '@/components/layout/header';
import { Loader2 } from 'lucide-react';
import { doc, getDocs, query, collection, where, limit, updateDoc } from 'firebase/firestore';
import { useMemoFirebase } from '@/firebase/provider';
import { EmployeeLayout } from '../layout/employee-layout';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';

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
        if (user || !auth || !firestore || typeof window === 'undefined' || isTelegramAuthAttempted) {
             if(user || isTelegramAuthAttempted) {
                if(!isTelegramAuthAttempted) setIsTelegramAuthAttempted(true);
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

                    const loginOrProvisionWithTelegram = async () => {
                        try {
                            const usersRef = collection(firestore, 'users');
                            const q = query(usersRef, where("telegramId", "==", telegramId), limit(1));
                            const querySnapshot = await getDocs(q);
    
                            if (querySnapshot.empty) {
                                console.log(`No user provisioned for Telegram ID: ${telegramId}.`);
                                return;
                            }
    
                            const userDoc = querySnapshot.docs[0];
                            const userProfileData = userDoc.data();
                            const email = userProfileData.email;
                            const password = `tg_pass_${telegramId}_secret`;
    
                            if (!email) {
                                console.error(`Provisioned user for TG ID ${telegramId} has no email.`);
                                return;
                            }
    
                            try {
                                await signInWithEmailAndPassword(auth, email, password);
                            } catch (error: any) {
                                if (error.code === 'auth/user-not-found') {
                                    console.log(`Auth user not found for ${email}. Creating now...`);
                                    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                                    await updateDoc(userDoc.ref, {
                                        uid: userCredential.user.uid
                                    });
                                    console.log(`Auth user created and linked for ${email}.`);
                                } else {
                                    throw error;
                                }
                            }
                        } catch (error) {
                            console.error("Telegram auto-login failed:", error);
                        } finally {
                            setIsTelegramAuthAttempted(true);
                        }
                    };

                    loginOrProvisionWithTelegram();

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
    }, [auth, firestore, user, isTelegramAuthAttempted]);


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
