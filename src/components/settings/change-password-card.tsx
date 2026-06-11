'use client';

import { useState } from 'react';
import { useUser } from '@/firebase/hooks';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, KeyRound } from 'lucide-react';
import { changePasswordAction } from '@/app/settings/actions';

export function ChangePasswordCard() {
    const { user } = useUser();
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const { toast } = useToast();

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) {
            toast({
                variant: 'destructive',
                title: 'Ошибка',
                description: 'Вы должны быть авторизованы для смены пароля.',
            });
            return;
        }

        if (password !== confirmPassword) {
            toast({
                variant: 'destructive',
                title: 'Ошибка',
                description: 'Пароли не совпадают.',
            });
            return;
        }

        if (password.length < 6) {
            toast({
                variant: 'destructive',
                title: 'Ошибка',
                description: 'Пароль должен содержать не менее 6 символов.',
            });
            return;
        }

        setLoading(true);
        try {
            const idToken = await user.getIdToken();
            const res = await changePasswordAction(idToken, password);

            if (!res.success) {
                throw new Error(res.message);
            }

            toast({
                title: 'Успех!',
                description: 'Пароль успешно обновлен.',
            });
            setPassword('');
            setConfirmPassword('');
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Ошибка смены пароля',
                description: error.message || 'Не удалось сменить пароль.',
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Card className="shadow-md border border-muted-foreground/15 hover:border-muted-foreground/25 transition-all duration-300">
            <form onSubmit={handleChangePassword}>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <div className="p-2 rounded-lg bg-primary/10 text-primary">
                            <KeyRound className="h-5 w-5" />
                        </div>
                        <div>
                            <CardTitle className="text-xl">Смена пароля</CardTitle>
                            <CardDescription>
                                Измените свой автогенерированный или старый пароль.
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="new-password">Новый пароль</Label>
                        <Input
                            id="new-password"
                            type="password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            minLength={6}
                            placeholder="Минимум 6 символов"
                            className="bg-muted/30 focus-visible:ring-primary"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="confirm-password">Подтверждение пароля</Label>
                        <Input
                            id="confirm-password"
                            type="password"
                            required
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            minLength={6}
                            placeholder="Повторите новый пароль"
                            className="bg-muted/30 focus-visible:ring-primary"
                        />
                    </div>
                </CardContent>
                <CardFooter>
                    <Button type="submit" className="w-full font-medium" disabled={loading}>
                        {loading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Обновление...
                            </>
                        ) : (
                            'Обновить пароль'
                        )}
                    </Button>
                </CardFooter>
            </form>
        </Card>
    );
}
