'use client';

import React, { useState } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useFirestore, useCollection } from '@/firebase/hooks';
import { useMemoFirebase, useFirebase } from '@/firebase/provider';
import { query, collection, orderBy, doc, setDoc, serverTimestamp, updateDoc, deleteDoc } from 'firebase/firestore';
import { ERPCategory } from '@/lib/types/erp';
import { useToast } from '@/hooks/use-toast';
import { 
    RefreshCw, 
    Layers, 
    ArrowUp, 
    ArrowDown,
    Plus,
    Trash2
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function CategoryManagerPage() {
    const firestore = useFirestore();
    const { orgId } = useFirebase();
    const { toast } = useToast();
    const [isSaving, setIsSaving] = useState(false);

    const categoriesQuery = useMemoFirebase(() => 
        (firestore && orgId) ? query(collection(firestore, 'organizations', orgId, 'categories'), orderBy('order', 'asc')) : null, 
    [firestore, orgId]);
    const { data: categories, isLoading } = useCollection<ERPCategory>(categoriesQuery);

    const handleUpdateName = async (id: string, name: string) => {
        if (!firestore || !orgId) return;
        try {
            await updateDoc(doc(firestore, 'organizations', orgId, 'categories', id), { name, updatedAt: serverTimestamp() });
        } catch (e) {
            toast({ title: 'Ошибка', description: 'Не удалось обновить название' });
        }
    };

    const handleDelete = async (id: string) => {
        if (!firestore || !orgId || !window.confirm('Вы уверены, что хотите удалить эту категорию?')) return;
        try {
            await deleteDoc(doc(firestore, 'organizations', orgId, 'categories', id));
            toast({ title: 'Удалено', description: 'Категория успешно удалена.' });
        } catch (e) {
            toast({ title: 'Ошибка', description: 'Не удалось удалить категорию' });
        }
    };

    const handleMove = async (index: number, direction: 'up' | 'down') => {
        if (!firestore || !orgId || !categories) return;
        const newCategories = [...categories];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        
        if (targetIndex < 0 || targetIndex >= newCategories.length) return;

        // Swap orders
        const current = newCategories[index];
        const target = newCategories[targetIndex];
        
        const currentOrder = current.order;
        const targetOrder = target.order;

        await Promise.all([
            updateDoc(doc(firestore, 'organizations', orgId, 'categories', current.id), { order: targetOrder }),
            updateDoc(doc(firestore, 'organizations', orgId, 'categories', target.id), { order: currentOrder })
        ]);

        toast({ title: 'Порядок изменен' });
    };

    const [newCatId, setNewCatId] = useState('');
    const [newCatName, setNewCatName] = useState('');

    const handleAddCategory = async () => {
        if (!firestore || !orgId || !newCatId || !newCatName) return;
        
        // Validate if ID is numeric
        if (isNaN(Number(newCatId))) {
            toast({ title: 'Ошибка', description: 'ID категории должен быть числом', variant: 'destructive' });
            return;
        }

        setIsSaving(true);
        try {
            await setDoc(doc(firestore, 'organizations', orgId, 'categories', newCatId), {
                id: newCatId,
                name: newCatName,
                order: (categories?.length || 0) + 1,
                isActive: true,
                updatedAt: serverTimestamp()
            });
            setNewCatId('');
            setNewCatName('');
            toast({ title: 'Категория добавлена' });
        } catch (e) {
            toast({ title: 'Ошибка', description: 'Не удалось добавить категорию' });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-8 pb-20">
            <PageHeader 
                title="Настройка Категорий" 
                description="Управление названиями и порядком отображения категорий из Poster."
            />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Add New Section */}
                <Card className="lg:col-span-1 bg-card border-none shadow-xl rounded-3xl h-fit">
                    <CardHeader>
                        <CardTitle className="text-lg font-black flex items-center gap-2">
                            <Plus className="h-5 w-5 text-primary" />
                            Добавить Категорию
                        </CardTitle>
                        <CardDescription>Введите ID категории из Poster и её красивое название для FLOW.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-muted-foreground ml-1">ID Категории из Poster (Число)</label>
                            <Input 
                                type="number"
                                placeholder="Напр: 12" 
                                value={newCatId}
                                onChange={(e) => setNewCatId(e.target.value)}
                                className="rounded-xl bg-muted/50 border-none"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Название во FLOW</label>
                            <Input 
                                placeholder="Напр: Напитки" 
                                value={newCatName}
                                onChange={(e) => setNewCatName(e.target.value)}
                                className="rounded-xl bg-muted/50 border-none"
                            />
                        </div>
                        <Button 
                            className="w-full rounded-xl font-bold h-12 mt-2" 
                            disabled={isSaving || !newCatId || !newCatName}
                            onClick={handleAddCategory}
                        >
                            {isSaving ? 'Сохранение...' : 'Добавить в список'}
                        </Button>
                    </CardContent>
                </Card>

                {/* List Section */}
                <Card className="lg:col-span-2 bg-card border-none shadow-2xl rounded-[2.5rem] overflow-hidden">
                    <CardHeader className="bg-muted/30 p-8">
                        <CardTitle className="flex items-center gap-2 text-xl font-black">
                            <Layers className="h-6 w-6 text-primary" />
                            Активные Категории
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/10 border-none hover:bg-transparent">
                                    <TableHead className="w-16"></TableHead>
                                    <TableHead className="w-32 pl-8 text-[10px] uppercase font-black">Poster ID</TableHead>
                                    <TableHead className="text-[10px] uppercase font-black text-center">Имя во FLOW</TableHead>
                                    <TableHead className="text-right pr-6 text-[10px] uppercase font-black">Порядок</TableHead>
                                    <TableHead className="w-16"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow><TableCell colSpan={5} className="text-center py-20 opacity-50"><RefreshCw className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
                                ) : (categories || []).length === 0 ? (
                                    <TableRow><TableCell colSpan={5} className="text-center py-20 text-muted-foreground italic">Категории не настроены. Добавьте первую из Poster.</TableCell></TableRow>
                                ) : categories?.map((cat, index) => (
                                    <TableRow key={cat.id} className="group hover:bg-muted/10 border-border/40 transition-colors">
                                        <TableCell className="pl-6">
                                            <div className="flex items-center gap-1 opacity-20 group-hover:opacity-100 transition-opacity">
                                                <Button 
                                                    size="icon" 
                                                    variant="ghost" 
                                                    className="h-8 w-8 rounded-lg hover:bg-primary/20 hover:text-primary disabled:opacity-30"
                                                    disabled={index === 0}
                                                    onClick={() => handleMove(index, 'up')}
                                                >
                                                    <ArrowUp className="h-4 w-4" />
                                                </Button>
                                                <Button 
                                                    size="icon" 
                                                    variant="ghost" 
                                                    className="h-8 w-8 rounded-lg hover:bg-primary/20 hover:text-primary disabled:opacity-30"
                                                    disabled={index === categories.length - 1}
                                                    onClick={() => handleMove(index, 'down')}
                                                >
                                                    <ArrowDown className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                        <TableCell className="font-mono font-black text-primary text-base pl-8">{cat.id}</TableCell>
                                        <TableCell>
                                            <Input 
                                                defaultValue={cat.name}
                                                onBlur={(e) => {
                                                    if (e.target.value !== cat.name) handleUpdateName(cat.id, e.target.value);
                                                }}
                                                className="bg-transparent border-none font-black text-lg text-center hover:bg-muted/30 focus:bg-muted focus:ring-1 focus:ring-primary h-12 rounded-2xl transition-all"
                                            />
                                        </TableCell>
                                        <TableCell className="text-right pr-6">
                                            <div className="inline-flex items-center justify-center h-10 w-10 rounded-2xl bg-muted/50 font-black text-xs group-hover:bg-primary group-hover:text-white transition-all shadow-inner">
                                                {cat.order}
                                            </div>
                                        </TableCell>
                                        <TableCell className="pr-8">
                                            <Button 
                                                size="icon" 
                                                variant="ghost" 
                                                className="h-10 w-10 rounded-2xl text-muted-foreground hover:bg-rose-500/10 hover:text-rose-500 transition-all opacity-0 group-hover:opacity-100"
                                                onClick={() => handleDelete(cat.id)}
                                            >
                                                <Trash2 className="h-5 w-5" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
            
            <div className="bg-blue-500/10 border border-blue-500/20 p-8 rounded-[2.5rem] text-blue-500 max-w-2xl shadow-xl shadow-blue-500/5 mt-10">
                <p className="text-lg font-black flex items-center gap-3 mb-4">
                    💡 Советы по настройке:
                </p>
                <div className="space-y-3 text-sm leading-relaxed opacity-90 font-medium">
                    <p>• Названия категорий можно редактировать прямо в таблице — изменения сохраняются при выходе из поля.</p>
                    <p>• Используйте стрелки слева для изменения порядка отображения в отчетах.</p>
                    <p>• Мусорная корзина справа удаляет ошибочно введенные категории.</p>
                </div>
            </div>
        </div>
    );
}
