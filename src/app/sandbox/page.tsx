'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Combobox } from '@/components/ui/combobox';
import { Trash } from 'lucide-react';
import { getIngredients, type Ingredient } from '@/lib/poster';
import { getFirestore, addDoc, collection, serverTimestamp, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { useFirestore, useUser } from '@/firebase/hooks';
import { useToast } from '@/hooks/use-toast';
import { getFirebaseApp } from '@/firebase/server';

export const dynamic = 'force-dynamic';

// Server action to get latest prices for ingredients
async function getLatestPrices(ingredientIds: string[]): Promise<Record<string, number>> {
    'use server';
    const db = getFirestore(getFirebaseApp()); // Assume getFirebaseApp is available
    const prices: Record<string, number> = {};

    const pricePromises = ingredientIds.map(async (id) => {
        const pricesQuery = query(
            collection(db, `ingredients/${id}/price_history`),
            orderBy('date', 'desc'),
            limit(1)
        );
        const querySnapshot = await getDocs(pricesQuery);
        if (!querySnapshot.empty) {
            return { id, price: querySnapshot.docs[0].data().price };
        }
        return { id, price: 0 };
    });

    const results = await Promise.all(pricePromises);
    results.forEach(result => {
        prices[result.id] = result.price;
    });

    return prices;
}

// Server action to save the sandbox item
async function saveSandboxItem(itemData: any) {
    'use server';
    const db = getFirestore(getFirebaseApp());
    await addDoc(collection(db, 'sandbox_items'), itemData);
}

async function getIngredientsAction(): Promise<Ingredient[]> {
    'use server';
    return getIngredients();
}

const sandboxSchema = z.object({
    name: z.string().min(1, 'Название обязательно'),
    ingredients: z.array(z.object({
        ingredientId: z.string().min(1, 'Выберите ингредиент'),
        quantity: z.coerce.number().min(0.001, 'Количество должно быть больше 0'),
    })).min(1, 'Добавьте хотя бы один ингредиент'),
});

export default function SandboxPage() {
    const { toast } = useToast();
    const { user } = useUser();
    const [prices, setPrices] = useState<Record<string, number>>({});
    const [allIngredients, setAllIngredients] = useState<Ingredient[]>([]);
    const [loading, setLoading] = useState(true);
    
    const form = useForm<z.infer<typeof sandboxSchema>>({
        resolver: zodResolver(sandboxSchema),
        defaultValues: {
            name: '',
            ingredients: [{ ingredientId: '', quantity: 0.1 }], // Default quantity in kg
        },
    });

    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: 'ingredients',
    });

    useEffect(() => {
        const fetchInitialData = async () => {
            setLoading(true);
            const ingredients = await getIngredientsAction();
            setAllIngredients(ingredients);
            const ingredientIds = ingredients.map(i => i.ingredient_id);
            if (ingredientIds.length > 0) {
                const fetchedPrices = await getLatestPrices(ingredientIds);
                setPrices(fetchedPrices);
            }
            setLoading(false);
        };
        fetchInitialData();
    }, []);

    const ingredientOptions = useMemo(() =>
        allIngredients.map(ing => ({
            value: ing.ingredient_id,
            label: `${ing.ingredient_name} (${ing.ingredient_unit})`,
        })),
    [allIngredients]);

    const watchedIngredients = form.watch('ingredients');

    const totalCost = useMemo(() => {
        return watchedIngredients.reduce((total, item) => {
            const price = prices[item.ingredientId] || 0;
            return total + (item.quantity * price);
        }, 0);
    }, [watchedIngredients, prices]);


    async function onSubmit(values: z.infer<typeof sandboxSchema>) {
        if (!user) {
            toast({ variant: 'destructive', title: 'Ошибка', description: 'Вы должны быть авторизованы.' });
            return;
        }

        const sandboxItem = {
            name: values.name,
            userId: user.uid,
            createdAt: serverTimestamp(),
            ingredients: values.ingredients.map(ing => ({
                ingredientId: ing.ingredientId,
                ingredientName: allIngredients.find(i => i.ingredient_id === ing.ingredientId)?.ingredient_name || '',
                quantity: ing.quantity,
                price: prices[ing.ingredientId] || 0,
            })),
            totalCost,
        };

        try {
            await saveSandboxItem(sandboxItem);
            toast({ title: 'Успех!', description: 'Черновик сохранен в Firestore.' });
            form.reset();
        } catch (error) {
            console.error("Failed to save sandbox item", error);
            toast({ variant: 'destructive', title: 'Ошибка!', description: 'Не удалось сохранить черновик.' });
        }
    }

    if (loading) {
        return (
            <div className="space-y-6">
                <PageHeader title="Конструктор (Sandbox)" description="Создавайте и рассчитывайте себестоимость новых блюд." />
                <p>Загрузка данных...</p>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <PageHeader title="Конструктор (Sandbox)" description="Создавайте и рассчитывайте себестоимость новых блюд." />
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Новое блюдо</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <FormField
                                control={form.control}
                                name="name"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Название блюда</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Например, 'Фирменный хот-дог'" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <div className="space-y-2">
                                <FormLabel>Ингредиенты</FormLabel>
                                {fields.map((field, index) => (
                                    <div key={field.id} className="grid grid-cols-[1fr_auto_auto] items-end gap-2 p-2 border rounded-md">
                                        <Controller
                                            control={form.control}
                                            name={`ingredients.${index}.ingredientId`}
                                            render={({ field: controllerField, fieldState }) => (
                                                <FormItem>
                                                    <Combobox
                                                        options={ingredientOptions}
                                                        value={controllerField.value}
                                                        onChange={controllerField.onChange}
                                                        placeholder="Выберите ингредиент..."
                                                        searchPlaceholder="Поиск..."
                                                        notFoundMessage="Не найдено."
                                                    />
                                                    <FormMessage>{fieldState.error?.message}</FormMessage>
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name={`ingredients.${index}.quantity`}
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormControl>
                                                        <Input {...field} type="number" step="0.001" placeholder="Вес (кг)" className="w-28" />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} disabled={fields.length <= 1}>
                                            <Trash className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ))}
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="mt-2"
                                    onClick={() => append({ ingredientId: '', quantity: 0.1 })}
                                >
                                    Добавить ингредиент
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                    
                    <Card>
                        <CardHeader>
                            <CardTitle>Расчет себестоимости</CardTitle>
                        </CardHeader>
                        <CardContent>
                             <div className="text-2xl font-bold">
                                Общая себестоимость: {new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' }).format(totalCost)}
                             </div>
                        </CardContent>
                    </Card>

                    <Button type="submit" disabled={form.formState.isSubmitting}>
                        {form.formState.isSubmitting ? 'Сохранение...' : 'Сохранить черновик'}
                    </Button>
                </form>
            </Form>
        </div>
    );
}
