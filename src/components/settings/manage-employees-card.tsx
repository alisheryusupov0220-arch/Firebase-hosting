'use client';

import { useState, useTransition, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { updateUserAction, getUsersAction } from '@/app/settings/actions';
import type { UserProfileServer } from '@/app/settings/actions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, UserCog } from 'lucide-react';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { useFirestore, useCollection } from '@/firebase/hooks';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { firebaseConfig } from '@/firebase/config';
import { ScrollArea } from '../ui/scroll-area';
import { useMemoFirebase } from '@/firebase/provider';
import { collection, query, orderBy } from 'firebase/firestore';

const newUserSchema = z.object({
    displayName: z.string().min(1, "Имя обязательно для заполнения"),
    telegramId: z.string().min(1, "Telegram ID обязателен для заполнения"),
    email: z.string().email("Неверный формат email"),
    password: z.string().min(6, "Пароль должен быть не менее 6 символов"),
    role: z.enum(['admin', 'employee']).default('employee'),
});


function AddUserDialog() {
    const [isOpen, setIsOpen] = useState(false);
    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();
    const firestore = useFirestore();

    const form = useForm<z.infer<typeof newUserSchema>>({
        resolver: zodResolver(newUserSchema),
        defaultValues: {
            displayName: '',
            telegramId: '',
            email: '',
            password: '',
            role: 'employee',
        },
    });

    const onSubmit = (values: z.infer<typeof newUserSchema>) => {
        startTransition(async () => {
            if (!firestore) {
                toast({ variant: "destructive", title: "Ошибка", description: "Firestore не инициализирован." });
                return;
            }

            // Using a temporary, secondary Firebase App instance for user creation
            // to avoid logging out the current admin user.
            const tempAppName = `user-creation-${Date.now()}`;
            const tempApp = initializeApp(firebaseConfig, tempAppName);
            const tempAuth = getAuth(tempApp);

            try {
                const userCredential = await createUserWithEmailAndPassword(tempAuth, values.email, values.password);
                const user = userCredential.user;

                const userRef = doc(firestore, 'users', user.uid);
                await setDoc(userRef, {
                    displayName: values.displayName,
                    telegramId: values.telegramId,
                    email: values.email,
                    role: values.role,
                });
                
                toast({ title: "Успех!", description: "Сотрудник успешно добавлен." });
                setIsOpen(false);
                form.reset();

            } catch (error: any) {
                let errorMessage = "Произошла неизвестная ошибка.";
                if (error.code === 'auth/email-already-in-use') {
                    errorMessage = "Этот email уже используется.";
                } else if (error.message) {
                    errorMessage = error.message;
                }
                toast({ variant: "destructive", title: "Ошибка создания сотрудника", description: errorMessage });
            } finally {
                // Clean up the temporary app instance
                await deleteApp(tempApp);
            }
        });
    };
    
    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button><Plus className="mr-2 h-4 w-4" /> Добавить</Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Добавить нового сотрудника</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                        <FormField
                            control={form.control}
                            name="displayName"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Имя</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Иван Петров" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                         <FormField
                            control={form.control}
                            name="telegramId"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Telegram ID</FormLabel>
                                    <FormControl>
                                        <Input placeholder="123456789" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="email"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Email</FormLabel>
                                    <FormControl>
                                        <Input type="email" placeholder="user@example.com" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                         <FormField
                            control={form.control}
                            name="password"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Пароль</FormLabel>
                                    <FormControl>
                                        <Input type="password" placeholder="******" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="role"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Роль</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Выберите роль" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="employee">Сотрудник</SelectItem>
                                            <SelectItem value="admin">Администратор</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <DialogFooter className="pt-4">
                            <DialogClose asChild>
                                <Button type="button" variant="outline">Отмена</Button>
                            </DialogClose>
                            <Button type="submit" disabled={isPending}>
                                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Создать
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}

function EditUserDialog({ user }: { user: UserProfileServer }) {
    const [isOpen, setIsOpen] = useState(false);
    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();
    
    const [role, setRole] = useState(user.role || 'employee');
    const [telegramId, setTelegramId] = useState(user.telegramId || '');

    const handleSave = () => {
        startTransition(async () => {
            const result = await updateUserAction(user.id, { role, telegramId });
            if (result.success) {
                toast({ title: "Успех", description: "Данные пользователя обновлены." });
                setIsOpen(false);
            } else {
                toast({ variant: "destructive", title: "Ошибка", description: result.message });
            }
        });
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon">
                    <UserCog className="h-4 w-4" />
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Редактировать пользователя</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label>Email</Label>
                        <Input value={user.email} disabled />
                    </div>
                    <div className="space-y-2">
                        <Label>Имя</Label>
                        <Input value={user.displayName} disabled />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="role">Роль</Label>
                        <Select value={role} onValueChange={(v: any) => setRole(v)}>
                            <SelectTrigger id="role">
                                <SelectValue placeholder="Выберите роль" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="admin">Администратор</SelectItem>
                                <SelectItem value="employee">Сотрудник</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="telegramId">Telegram ID</Label>
                        <Input 
                            id="telegramId" 
                            value={telegramId}
                            onChange={(e) => setTelegramId(e.target.value)}
                            placeholder="Введите Telegram ID"
                        />
                    </div>
                </div>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button variant="outline">Отмена</Button>
                    </DialogClose>
                    <Button onClick={handleSave} disabled={isPending}>
                        {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Сохранить
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}


export function ManageEmployeesCard() {
    const firestore = useFirestore();

    // Use a real-time hook to listen for changes in the users collection.
    // This is the definitive fix.
    const usersQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'users'), orderBy('displayName', 'asc'));
    }, [firestore]);

    const { data: users, isLoading } = useCollection<UserProfileServer>(usersQuery);

    return (
        <Card className="lg:col-span-2">
            <CardHeader className="flex-row items-start justify-between">
                <div>
                    <CardTitle>Управление сотрудниками</CardTitle>
                    <CardDescription>
                        Настройте роли и данные сотрудников для доступа к системе.
                    </CardDescription>
                </div>
                <AddUserDialog />
            </CardHeader>
            <CardContent>
                <ScrollArea className="h-72">
                    {isLoading ? (
                        <div className="flex items-center justify-center h-24">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Имя</TableHead>
                                    <TableHead>Email</TableHead>
                                    <TableHead>Роль</TableHead>
                                    <TableHead>Telegram ID</TableHead>
                                    <TableHead className="text-right">Действия</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {users?.map(user => (
                                    <TableRow key={user.id}>
                                        <TableCell>{user.displayName || '-'}</TableCell>
                                        <TableCell>{user.email}</TableCell>
                                        <TableCell>{user.role}</TableCell>
                                        <TableCell>{user.telegramId || '-'}</TableCell>
                                        <TableCell className="text-right">
                                            <EditUserDialog user={user} />
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </ScrollArea>
            </CardContent>
        </Card>
    );
}
