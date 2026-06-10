'use client';
import { useUser, useFirestore, useDoc } from '@/firebase/hooks';
import { doc } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '../ui/skeleton';
import { useMemoFirebase } from '@/firebase/provider';
import { updateUserAction } from '@/app/settings/actions';

type UserProfile = {
    displayName: string;
    email: string;
    role: 'admin' | 'employee' | 'brand_admin' | 'super_admin';
};

export function ProfileCard() {
    const { user, loading: userLoading } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();

    const userProfileRef = useMemoFirebase(() => {
        if (!firestore || !user?.uid) return null;
        return doc(firestore, 'users', user.uid);
    }, [firestore, user?.uid]);

    const { data: userProfile, isLoading: profileLoading } = useDoc<UserProfile>(userProfileRef);

    const handleRoleChange = async (newRole: 'admin' | 'employee') => {
        if (!user?.uid) return;
        
        try {
            const dbRole = newRole === 'admin' ? 'brand_admin' : 'employee';
            const res = await updateUserAction(user.uid, { role: dbRole });
            
            if (!res.success) {
                throw new Error(res.message);
            }
            
            // Sync claims so the user gets updated client-side permissions immediately
            const idToken = await user.getIdToken();
            const syncRes = await fetch('/api/auth/sync-claims', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${idToken}`,
                },
            });
            if (syncRes.ok) {
                await user.getIdToken(true); // Force refresh token
            }

            toast({
                title: 'Успех!',
                description: `Ваша роль обновлена на "${newRole === 'admin' ? 'Администратор' : 'Сотрудник'}".`,
            });
        } catch (error: any) {
            console.error('Failed to update role:', error);
            toast({
                variant: 'destructive',
                title: 'Ошибка обновления роли',
                description: error.message || 'Не удалось обновить роль. Попробуйте обновить страницу.',
            });
        }
    };
    
    const isLoading = userLoading || profileLoading;

    if (isLoading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Профиль</CardTitle>
                    <CardDescription>Управление данными вашего профиля.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Skeleton className="h-4 w-1/4" />
                        <Skeleton className="h-10 w-full" />
                    </div>
                     <div className="space-y-2">
                        <Skeleton className="h-4 w-1/4" />
                        <Skeleton className="h-10 w-full" />
                    </div>
                </CardContent>
            </Card>
        );
    }
    
    const mappedRole = userProfile?.role === 'brand_admin' || userProfile?.role === 'super_admin' ? 'admin' : (userProfile?.role || 'employee');

    return (
        <Card>
            <CardHeader>
                <CardTitle>Профиль</CardTitle>
                <CardDescription>Управление данными вашего профиля.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="displayName">Имя</Label>
                    <Input id="displayName" value={userProfile?.displayName || ''} disabled />
                </div>
                 <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" value={userProfile?.email || ''} disabled />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="role">Роль</Label>
                    <Select value={mappedRole} onValueChange={handleRoleChange}>
                        <SelectTrigger id="role" className="w-full">
                            <SelectValue placeholder="Выберите роль..." />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="employee">Сотрудник</SelectItem>
                            <SelectItem value="admin">Администратор</SelectItem>
                        </SelectContent>
                    </Select>
                     <p className="text-xs text-muted-foreground pt-1">
                        Администраторы могут одобрять поставки.
                     </p>
                </div>
            </CardContent>
        </Card>
    );
}
