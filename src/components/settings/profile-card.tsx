'use client';
import { useUser, useFirestore, useDoc } from '@/firebase/hooks';
import { doc, updateDoc } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '../ui/skeleton';
import { useMemoFirebase } from '@/firebase/provider';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';

type UserProfile = {
    displayName: string;
    email: string;
    role: 'admin' | 'employee';
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
        if (!firestore || !user?.uid) return;
        
        const userDocRef = doc(firestore, 'users', user.uid);
        
        try {
            await updateDoc(userDocRef, { role: newRole });
            toast({
                title: 'Успех!',
                description: `Ваша роль обновлена на "${newRole}".`,
            });
        } catch (error) {
             const permissionError = new FirestorePermissionError({
                path: userDocRef.path,
                operation: 'update',
                requestResourceData: { role: newRole },
            });
            errorEmitter.emit('permission-error', permissionError);
            toast({
                variant: 'destructive',
                title: 'Ошибка обновления роли',
                description: 'Недостаточно прав для выполнения операции. Попробуйте обновить страницу.',
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
                    <Select value={userProfile?.role} onValueChange={handleRoleChange}>
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
