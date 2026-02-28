'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/firebase/hooks';
import type { LocalIngredient } from '@/app/ingredients/actions';
import { getIngredientsForInventory, saveInventoryCountAction } from './actions';
import { Loader2 } from 'lucide-react';
import { translateUnit } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default function InventoryPage() {
    const { toast } = useToast();
    const { user } = useUser();
    const [allIngredients, setAllIngredients] = useState<LocalIngredient[]>([]);
    const [quantities, setQuantities] = useState<Record<string, string>>({});
    const [comment, setComment] = useState('');
    const [filter, setFilter] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        async function loadIngredients() {
            setIsLoading(true);
            const ingredients = await getIngredientsForInventory();
            setAllIngredients(ingredients);
            setIsLoading(false);
        }
        loadIngredients();
    }, []);

    const handleQuantityChange = (ingredientId: string, value: string) => {
        setQuantities(prev => ({ ...prev, [ingredientId]: value }));
    };

    const filteredIngredients = useMemo(() => {
        if (!filter) {
            return allIngredients;
        }
        return allIngredients.filter(ing =>
            ing.name.toLowerCase().includes(filter.toLowerCase())
        );
    }, [allIngredients, filter]);

    const handleSave = async () => {
        if (!comment.trim()) {
            toast({ variant: 'destructive', title: 'Ошибка', description: 'Пожалуйста, введите комментарий или название инвентаризации.' });
            return;
        }

        if (!user) {
            toast({ variant: 'destructive', title: 'Ошибка', description: 'Для сохранения вы должны быть авторизованы.' });
            return;
        }

        const itemsToSave = Object.entries(quantities)
            .map(([ingredientId, quantityStr]) => {
                const quantity = parseFloat(quantityStr);
                if (!quantity || quantity <= 0) return null;

                const ingredient = allIngredients.find(ing => ing.id === ingredientId);
                if (!ingredient) return null;

                return {
                    ingredientId: ingredient.id,
                    ingredientName: ingredient.name,
                    unit: ingredient.unit,
                    quantity: quantity,
                };
            })
            .filter((item): item is NonNullable<typeof item> => item !== null);

        if (itemsToSave.length === 0) {
            toast({ variant: 'destructive', title: 'Нечего сохранять', description: 'Введите количество хотя бы для одного ингредиента.' });
            return;
        }

        setIsSaving(true);
        const result = await saveInventoryCountAction({
            comment,
            items: itemsToSave,
            userId: user.uid,
            userName: user.email || 'Unknown User',
        });
        setIsSaving(false);

        if (result.success) {
            toast({ title: 'Успех!', description: 'Данные инвентаризации сохранены.' });
            setQuantities({});
            setComment('');
            setFilter('');
        } else {
            toast({ variant: 'destructive', title: 'Ошибка сохранения', description: result.message });
        }
    };

    if (isLoading) {
        return (
            <div className="flex min-h-[400px] w-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <PageHeader
                title="Проведение инвентаризации"
                description="Зафиксируйте фактические остатки ингредиентов в системе."
            />

            <Card>
                <CardHeader>
                    <CardTitle>Новая инвентаризация</CardTitle>
                    <CardDescription>
                        Введите название (например, &quot;Еженедельная проверка бара&quot;) и заполните фактическое количество для нужных позиций.
                        Пустые поля не будут сохранены.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Input
                        placeholder="Комментарий или название инвентаризации..."
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        className="max-w-lg"
                    />
                    <Input
                        placeholder="Поиск ингредиента..."
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                        className="max-w-lg"
                    />
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Список ингредиентов</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Название ингредиента</TableHead>
                                    <TableHead className="w-[100px]">Ед. изм.</TableHead>
                                    <TableHead className="w-[180px] text-right">Фактическое кол-во</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredIngredients.length > 0 ? (
                                    filteredIngredients.map(ing => (
                                        <TableRow key={ing.id}>
                                            <TableCell className="font-medium">{ing.name}</TableCell>
                                            <TableCell className="text-muted-foreground">{translateUnit(ing.unit)}</TableCell>
                                            <TableCell className="text-right">
                                                <Input
                                                    type="number"
                                                    placeholder="0.00"
                                                    value={quantities[ing.id] || ''}
                                                    onChange={(e) => handleQuantityChange(ing.id, e.target.value)}
                                                    className="text-right"
                                                    step="0.001"
                                                    min="0"
                                                />
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={3} className="h-24 text-center">
                                            Ингредиенты не найдены.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                    <div className="mt-6 flex justify-end">
                        <Button onClick={handleSave} disabled={isSaving}>
                            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Сохранить инвентаризацию
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
