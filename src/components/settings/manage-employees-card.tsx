'use client';

import { useEffect, useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { useAuth, useFirestore } from '@/firebase/hooks';
import { getUsersAction, updateUserAction, type UserProfileServer } from '@/app/settings/actions';
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

const newUserSchema = z.object({
    displayName: z.string().min(1, "Имя обязательно для заполнения"),
    telegramId: z.string().min(1, "Telegram ID обязателен для заполнения"),
    role: z.enum(['admin', 'employee']).default('employee'),
});


function AddUserDialog({ onUserAdded }: { onUserAdded: () => void }) {
    const [isOpen, setIsOpen] = useState(false);
    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();
    const auth = useAuth();
    const firestore = useFirestore();

    const form = useForm<z.infer<typeof newUserSchema>>({
        resolver: zodResolver(newUserSchema),
        defaultValues: {
            displayName: '',
            telegramId: '',
            role: 'employee',
        },
    });

    const onSubmit = (values: z.infer<typeof newUserSchema>) => {
        startTransition(async () => {
            if (!auth || !firestore) {
                toast({ variant: "destructive", title: "Ошибка", description: "Сервисы Firebase не инициализированы." });
                return;
            }
            try {
                // Generate predictable credentials
                const email = `telegram_${values.telegramId}@doganddog.invent`;
                const password = `tg_pass_${values.telegramId}_secret`;

                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                const user = userCredential.user;

                const userRef = doc(firestore, 'users', user.uid);
                await setDoc(userRef, {
                    displayName: values.displayName,
                    email: email, // Store dummy email
                    role: values.role,
                    telegramId: values.telegramId,
                });
                
                toast({ title: "Успех!", description: "Сотрудник добавлен. Сейчас страница перезагрузится." });

                // The new user is now signed in. We sign them out to return control to the admin.
                if (auth) {
                    await signOut(auth);
                }
                
                // Reload the page. The admin will be prompted to log in again, and will see the new user.
                window.location.reload();


            } catch (error: any) {
                let errorMessage = error.message;
                if (error.code === 'auth/email-already-in-use') {
                    errorMessage = "Сотрудник с таким Telegram ID уже существует.";
                }
                toast({ variant: "destructive", title: "Ошибка", description: errorMessage });
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

function EditUserDialog({ user, onUpdate }: { user: UserProfileServer, onUpdate: () => void }) {
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
                onUpdate();
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
    const [users, setUsers] = useState<UserProfileServer[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchUsers = async () => {
        setIsLoading(true);
        const userList = await getUsersAction();
        setUsers(userList);
        setIsLoading(false);
    }

    useEffect(() => {
        fetchUsers();
    }, []);

    return (
        <Card className="lg:col-span-2">
            <CardHeader className="flex-row items-start justify-between">
                <div>
                    <CardTitle>Управление сотрудниками</CardTitle>
                    <CardDescription>
                        Настройте роли и данные сотрудников для доступа к системе.
                    </CardDescription>
                </div>
                <AddUserDialog onUserAdded={fetchUsers} />
            </CardHeader>
            <CardContent>
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
                            {users.map(user => (
                                <TableRow key={user.id}>
                                    <TableCell>{user.displayName || '-'}</TableCell>
                                    <TableCell>{user.email}</TableCell>
                                    <TableCell>{user.role}</TableCell>
                                    <TableCell>{user.telegramId || '-'}</TableCell>
                                    <TableCell className="text-right">
                                        <EditUserDialog user={user} onUpdate={fetchUsers} />
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )}
            </CardContent>
        </Card>
    );
}
