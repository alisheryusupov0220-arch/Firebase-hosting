'use client';

import React, { useState, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useFirebase } from '@/firebase/provider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, Trash2, ShieldAlert } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';

type Brand = {
  id: string;
  name: string;
  createdAt?: any;
};

type User = {
  id: string;
  email: string;
  displayName?: string;
  role: string;
  orgId?: string;
};

export default function SuperAdminPage() {
  const { user, role } = useFirebase();
  const router = useRouter();
  const { toast } = useToast();

  const [brands, setBrands] = useState<Brand[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCreating, startCreating] = useTransition();

  const [newBrandName, setNewBrandName] = useState('');
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminName, setNewAdminName] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');

  // 1. Authorization check
  useEffect(() => {
    if (role && role !== 'super_admin') {
      toast({
        variant: 'destructive',
        title: 'Доступ запрещен',
        description: 'Этот раздел предназначен только для супер-администраторов.',
      });
      router.push('/supplies');
    }
  }, [role, router, toast]);

  // 2. Fetch data
  const fetchData = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const token = await user.getIdToken();
      
      const [brandsRes, usersRes] = await Promise.all([
        fetch('/api/super-admin/brands', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/super-admin/users', { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      const brandsData = await brandsRes.json();
      const usersData = await usersRes.json();

      if (brandsData.success) setBrands(brandsData.brands);
      if (usersData.success) setUsers(usersData.users);

    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Ошибка загрузки данных', description: e.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && role === 'super_admin') {
      fetchData();
    }
  }, [user, role]);

  // 3. Create Brand Handler
  const handleCreateBrand = () => {
    startCreating(async () => {
      if (!user) return;
      try {
        const token = await user.getIdToken();
        const response = await fetch('/api/super-admin/brands', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            brandName: newBrandName,
            adminEmail: newAdminEmail,
            adminName: newAdminName,
            adminPassword: newAdminPassword,
          })
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'Ошибка при создании бренда.');
        }

        toast({ title: 'Успех!', description: 'Новый бренд и его администратор успешно созданы.' });
        setIsCreateOpen(false);
        // Reset form
        setNewBrandName('');
        setNewAdminEmail('');
        setNewAdminName('');
        setNewAdminPassword('');
        
        // Refresh list
        fetchData();
      } catch (e: any) {
        toast({ variant: 'destructive', title: 'Ошибка создания', description: e.message });
      }
    });
  };

  // 4. Delete User Handler
  const handleDeleteUser = async (uid: string) => {
    if (!confirm('Вы уверены, что хотите удалить этого пользователя?')) return;
    if (!user) return;
    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/super-admin/users?uid=${uid}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Ошибка при удалении.');
      }

      toast({ title: 'Успешно удалено', description: 'Пользователь удален из системы.' });
      fetchData();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Ошибка удаления', description: e.message });
    }
  };

  if (role !== 'super_admin') {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center space-y-4">
        <ShieldAlert className="h-16 w-16 text-destructive animate-pulse" />
        <h1 className="text-2xl font-bold">Доступ ограничен</h1>
        <p className="text-muted-foreground">Недостаточно прав для просмотра этой страницы.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-20">
      <div className="flex items-center justify-between">
        <PageHeader 
          title="Панель Super Admin" 
          description="Управление брендами, компаниями и глобальными пользователями системы." 
        />
        
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button size="lg" className="shadow-md">
              <Plus className="mr-2 h-5 w-5" /> Создать Бренд
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Создать новый бренд</DialogTitle>
              <DialogDescription>
                Создание отдельного бренда и его первого корневого администратора.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="brandName">Название бренда (компании)</Label>
                <Input 
                  id="brandName" 
                  placeholder="Flow Coffee" 
                  value={newBrandName} 
                  onChange={(e) => setNewBrandName(e.target.value)} 
                />
              </div>
              <div className="relative my-2">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">Администратор</span>
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="adminName">Имя администратора</Label>
                <Input 
                  id="adminName" 
                  placeholder="Алишер Юсупов" 
                  value={newAdminName} 
                  onChange={(e) => setNewAdminName(e.target.value)} 
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="adminEmail">Email администратора</Label>
                <Input 
                  id="adminEmail" 
                  type="email" 
                  placeholder="admin@flowcoffee.uz" 
                  value={newAdminEmail} 
                  onChange={(e) => setNewAdminEmail(e.target.value)} 
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="adminPassword">Пароль для входа</Label>
                <Input 
                  id="adminPassword" 
                  type="password" 
                  placeholder="******" 
                  value={newAdminPassword} 
                  onChange={(e) => setNewAdminPassword(e.target.value)} 
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>Отмена</Button>
              <Button type="button" onClick={handleCreateBrand} disabled={isCreating}>
                {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Создать
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Brands List */}
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Зарегистрированные бренды</CardTitle>
              <CardDescription>
                Список всех изолированных компаний в системе ({brands.length}).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Название</TableHead>
                    <TableHead>Org ID</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {brands.map((brand, idx) => (
                    <TableRow key={brand.id || `brand-${idx}`}>

                      <TableCell className="font-semibold text-foreground">{brand.name}</TableCell>
                      <TableCell><code>{brand.id}</code></TableCell>
                    </TableRow>
                  ))}
                  {brands.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={2} className="text-center text-muted-foreground py-6">
                        Бренды не найдены.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Users List */}
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Пользователи системы</CardTitle>
              <CardDescription>
                Список глобальных пользователей всех организаций ({users.length}).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Имя</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Роль / Бренд</TableHead>
                    <TableHead className="text-right">Действие</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u, idx) => (
                    <TableRow key={u.id || u.email || `user-${idx}`}>

                      <TableCell className="font-semibold">{u.displayName || '—'}</TableCell>
                      <TableCell className="text-xs">{u.email}</TableCell>
                      <TableCell className="text-xs">
                        <span className="capitalize font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 text-[10px]">
                          {u.role.replace('_', ' ')}
                        </span>
                        <div className="text-[10px] text-muted-foreground mt-1">
                          Org: <code>{u.orgId || 'super'}</code>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {u.role !== 'super_admin' && (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => handleDeleteUser(u.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
