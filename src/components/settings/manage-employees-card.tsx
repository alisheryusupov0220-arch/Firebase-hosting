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
import { useMemoFirebase, useFirebase } from '@/firebase/provider';
import { collection, query, orderBy, where } from 'firebase/firestore';

type LocationDoc = {
    id: string;
    name: string;
    posterStorageId: string;
};

const newUserSchema = z.object({
    displayName: z.string().min(1, "Имя обязательно для заполнения"),
    telegramId: z.string().optional(),
    email: z.string().email("Неверный формат email"),
    role: z.enum(['admin', 'employee', 'tablet']).default('employee'),
    locationId: z.string().optional(),
});


function AddUserDialog({ locations }: { locations: LocationDoc[] }) {
    const [isOpen, setIsOpen] = useState(false);
    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();

    const form = useForm<z.infer<typeof newUserSchema>>({
        resolver: zodResolver(newUserSchema),
        defaultValues: {
            displayName: '',
            telegramId: '',
            email: '',
            role: 'employee',
            locationId: '',
        },
    });

    const onSubmit = (values: z.infer<typeof newUserSchema>) => {
        startTransition(async () => {
            const auth = getAuth();
            const currentUser = auth.currentUser;
            if (!currentUser) {
                toast({ variant: "destructive", title: "Ошибка", description: "Вы не авторизованы." });
                return;
            }

            try {
                const token = await currentUser.getIdToken();
                const response = await fetch('/api/admin/invite-user', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        email: values.email,
                        role: values.role === 'admin' ? 'brand_admin' : values.role,
                        displayName: values.displayName,
                        telegramId: values.telegramId || null,
                        locationId: values.locationId || null,
                        locationIds: values.locationId ? [values.locationId] : null,
                    })
                });

                const data = await response.json();
                if (!response.ok) {
                    throw new Error(data.error || 'Ошибка при отправке приглашения.');
                }

                toast({ 
                    title: "Успех!", 
                    description: `Сотрудник добавлен. Пароль для входа: ${data.password}`,
                    duration: 10000,
                });
                setIsOpen(false);
                form.reset();

            } catch (error: any) {
                toast({ variant: "destructive", title: "Ошибка создания сотрудника", description: error.message || "Ошибка сервера" });
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
                                    <FormLabel>Telegram ID (необязательно)</FormLabel>
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
                                            <SelectItem value="tablet">Планшет</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="locationId"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Локация (Филиал)</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Выберите локацию" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {locations.map((loc) => (
                                                <SelectItem key={loc.id} value={loc.id}>
                                                    {loc.name}
                                                </SelectItem>
                                            ))}
                                            {locations.length === 0 && (
                                                <SelectItem value="none" disabled>
                                                    Локации не найдены
                                                </SelectItem>
                                            )}
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

function EditUserDialog({ user, locations }: { user: UserProfileServer, locations: LocationDoc[] }) {
    const [isOpen, setIsOpen] = useState(false);
    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();
    
    const [role, setRole] = useState(user.role || 'employee');
    const [telegramId, setTelegramId] = useState(user.telegramId || '');
    const [locationId, setLocationId] = useState(user.locationId || '');

    const handleSave = () => {
        startTransition(async () => {
            const result = await updateUserAction(user.id, { 
                role, 
                telegramId,
                locationId: locationId || null,
                locationIds: locationId ? [locationId] : null
            });
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
                                <SelectItem value="brand_admin">Администратор бренда</SelectItem>
                                <SelectItem value="employee">Сотрудник</SelectItem>
                                <SelectItem value="cashier">Кассир</SelectItem>
                                <SelectItem value="outlet_admin">Администратор локации</SelectItem>
                                <SelectItem value="tablet">Планшет (Ограниченный доступ)</SelectItem>
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
                    <div className="space-y-2">
                        <Label htmlFor="location">Локация</Label>
                        <Select value={locationId} onValueChange={setLocationId}>
                            <SelectTrigger id="location">
                                <SelectValue placeholder="Выберите локацию" />
                            </SelectTrigger>
                            <SelectContent>
                                {locations.map((loc) => (
                                    <SelectItem key={loc.id} value={loc.id}>
                                        {loc.name}
                                    </SelectItem>
                                ))}
                                {locations.length === 0 && (
                                    <SelectItem value="none" disabled>
                                        Локации не созданы
                                    </SelectItem>
                                )}
                            </SelectContent>
                        </Select>
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
    const { orgId, role } = useFirebase();

    // 1. Fetch locations
    const locationsQuery = useMemoFirebase(() => {
        if (!firestore || !orgId) return null;
        return query(collection(firestore, `organizations/${orgId}/locations`), orderBy('name', 'asc'));
    }, [firestore, orgId]);

    const { data: locations = [] } = useCollection<LocationDoc>(locationsQuery);

    // 2. Fetch users (filter by brand orgId if not super_admin)
    const usersQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        if (role === 'super_admin') {
            return query(collection(firestore, 'users'), orderBy('displayName', 'asc'));
        }
        return query(
            collection(firestore, 'users'),
            where('orgId', '==', orgId || ''),
            orderBy('displayName', 'asc')
        );
    }, [firestore, orgId, role]);

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
                <AddUserDialog locations={locations || []} />
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
                                        <TableCell className="capitalize text-xs font-semibold">{user.role?.replace('_', ' ') || '-'}</TableCell>
                                        <TableCell>{user.telegramId || '-'}</TableCell>
                                        <TableCell className="text-right">
                                            <EditUserDialog user={user} locations={locations || []} />
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
