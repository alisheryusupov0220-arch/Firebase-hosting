'use client';

import React, { useState, useEffect, useTransition } from 'react';
import { useFirestore, useCollection } from '@/firebase/hooks';
import { useFirebase, useMemoFirebase } from '@/firebase/provider';
import { collection, query, doc, setDoc, deleteDoc, orderBy } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { fetchStoragesAction } from '@/app/supplies/actions';
import { Storage } from '@/lib/poster';

type LocationDoc = {
  id: string;
  name: string;
  posterStorageId: string;
};

export function ManageLocationsCard() {
  const { orgId } = useFirebase();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [storages, setStorages] = useState<Storage[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [name, setName] = useState('');
  const [posterStorageId, setPosterStorageId] = useState('');

  // 1. Fetch locations in real-time
  const locationsQuery = useMemoFirebase(() => {
    if (!firestore || !orgId) return null;
    return query(
      collection(firestore, `organizations/${orgId}/locations`),
      orderBy('name', 'asc')
    );
  }, [firestore, orgId]);

  const { data: locations, isLoading } = useCollection<LocationDoc>(locationsQuery);

  // 2. Fetch Poster storages for the dropdown
  useEffect(() => {
    const loadStorages = async () => {
      try {
        const data = await fetchStoragesAction(orgId || undefined);
        setStorages(data);
      } catch (e) {
        console.error('Failed to load Poster storages:', e);
      }
    };
    if (orgId) {
      loadStorages();
    }
  }, [orgId]);

  // 3. Add Location handler
  const handleAddLocation = () => {
    if (!name || !posterStorageId) {
      toast({ variant: 'destructive', title: 'Ошибка', description: 'Заполните все поля.' });
      return;
    }

    startTransition(async () => {
      if (!firestore || !orgId) return;
      const locationId = 'loc_' + Math.random().toString(36).substring(2, 10);
      const locRef = doc(firestore, `organizations/${orgId}/locations`, locationId);

      try {
        await setDoc(locRef, {
          id: locationId,
          name,
          posterStorageId,
        });

        toast({ title: 'Успех!', description: 'Локация успешно добавлена.' });
        setIsOpen(false);
        setName('');
        setPosterStorageId('');
      } catch (e: any) {
        toast({ variant: 'destructive', title: 'Ошибка добавления', description: e.message });
      }
    });
  };

  // 4. Delete Location handler
  const handleDeleteLocation = async (id: string) => {
    if (!confirm('Удалить эту локацию?')) return;
    if (!firestore || !orgId) return;
    
    try {
      await deleteDoc(doc(firestore, `organizations/${orgId}/locations`, id));
      toast({ title: 'Успех', description: 'Локация удалена.' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Ошибка удаления', description: e.message });
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Локации (Филиалы)</CardTitle>
          <CardDescription>Управление торговыми точками и складами бренда.</CardDescription>
        </div>
        
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" /> Добавить
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Добавить новую локацию</DialogTitle>
              <DialogDescription>
                Введите название локации и свяжите её со складом в Poster.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="locName">Название локации</Label>
                <Input 
                  id="locName" 
                  placeholder="Основной склад / Филиал ЦУМ" 
                  value={name} 
                  onChange={(e) => setName(e.target.value)} 
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="posterStorage">Склад в Poster</Label>
                <Select value={posterStorageId} onValueChange={setPosterStorageId}>
                  <SelectTrigger id="posterStorage">
                    <SelectValue placeholder="Выберите склад Poster" />
                  </SelectTrigger>
                  <SelectContent>
                    {storages.map((storage) => (
                      <SelectItem key={storage.storage_id} value={String(storage.storage_id)}>
                        {storage.storage_name} (ID: {storage.storage_id})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">Отмена</Button>
              </DialogClose>
              <Button type="button" onClick={handleAddLocation} disabled={isPending}>
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Создать
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex h-20 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Название</TableHead>
                <TableHead>Склад Poster</TableHead>
                <TableHead className="text-right">Действие</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {locations?.map((loc) => {
                const storageName = storages.find(s => String(s.storage_id) === String(loc.posterStorageId))?.storage_name || `ID: ${loc.posterStorageId}`;
                return (
                  <TableRow key={loc.id}>
                    <TableCell className="font-medium">{loc.name}</TableCell>
                    <TableCell>{storageName}</TableCell>
                    <TableCell className="text-right">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => handleDeleteLocation(loc.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {locations?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground py-6">
                    Локации пока не добавлены.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
