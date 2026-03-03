'use client';

import React from 'react';
import { useCollection, useFirestore, useUser } from '@/firebase/hooks';
import { collection, query, doc, updateDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { approveSupplyOnPosterAction } from '@/app/supplies/actions';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { Ingredient, PosterSupplier, Storage } from '@/lib/poster';
import { useMemoFirebase } from '@/firebase/provider';
import { Skeleton } from '../ui/skeleton';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { formatNumberString, translateUnit } from '@/lib/utils';
import type { LocalIngredient } from '@/app/ingredients/actions';

type PendingSuppliesCardProps = {
    storages: Storage[];
    suppliers: PosterSupplier[];
    ingredients: LocalIngredient[];
};


export function PendingSuppliesCard({ storages, suppliers, ingredients }: PendingSuppliesCardProps) {
    const { toast } = useToast();
    const firestore = useFirestore();
    const { user } = useUser();
    
    const pendingSuppliesQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'pendingSupplies'));
    }, [firestore]);

    const { data: pendingSupplies, isLoading, error } = useCollection(pendingSuppliesQuery);
    
    const dataMap = React.useMemo(() => ({
        storages: new Map(storages.map(item => [item.storage_id, item.storage_name])),
        suppliers: new Map(suppliers.map(item => [item.supplier_id, item.supplier_name])),
        ingredients: new Map(ingredients.map(item => [item.id, item.name])),
    }), [storages, suppliers, ingredients]);

    const handleApprove = async (supply: any) => {
        if (!user || !firestore) {
            toast({ variant: 'destructive', title: 'Ошибка!', description: 'Вы не авторизованы.' });
            return;
        }

        const result = await approveSupplyOnPosterAction(supply.id);

        if (!result.success) {
            toast({ variant: 'destructive', title: 'Ошибка Poster!', description: result.message });
            return;
        }

        const newSupplyId = result.data;
        const pendingSupplyRef = doc(firestore, 'pendingSupplies', supply.id);
        
        try {
            const batch = writeBatch(firestore);

            batch.update(pendingSupplyRef, {
                status: 'approved',
                approvedBy: user.email,
                approvedAt: serverTimestamp(),
                posterSupplyId: newSupplyId,
            });

            const approvalTimestamp = new Date();
            supply.ingredients.forEach((ingredient: any) => {
                const priceHistoryRef = doc(firestore, `ingredients/${ingredient.ingredient_id}/price_history`, String(newSupplyId));
                
                const count = Number(ingredient.count);
                const totalSum = Number(ingredient.price);
                const pricePerUnit = count > 0 ? totalSum / count : 0;
                
                batch.set(priceHistoryRef, {
                    price: pricePerUnit,
                    date: approvalTimestamp,
                    supplierId: String(supply.supplier_id)
                });
            });

            await batch.commit();
            toast({ title: 'Успех!', description: 'Поставка одобрена.' });

        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Ошибка Firestore!', description: `Не удалось обновить статус заявки: ${e.message}` });
        }
    };

    const handleReject = async (id: string) => {
        if (!user || !firestore) {
            toast({ variant: 'destructive', title: 'Ошибка!', description: 'Вы не авторизованы.' });
            return;
        }
        const pendingSupplyRef = doc(firestore, 'pendingSupplies', id);
        await updateDoc(pendingSupplyRef, {
            status: 'rejected',
            rejectedBy: user.email,
            rejectedAt: serverTimestamp(),
        }).catch((e: any) => {
             toast({ variant: 'destructive', title: 'Ошибка!', description: `Ошибка отклонения: ${e.message}` });
        });
        toast({ title: 'Успех!', description: 'Заявка на поставку отклонена.' });
    };
    
    if (isLoading) {
         return (
            <Card>
                <CardHeader>
                    <Skeleton className="h-6 w-1/2" />
                    <Skeleton className="h-4 w-3/4" />
                </CardHeader>
                <CardContent>
                    <div className="space-y-2">
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                    </div>
                </CardContent>
            </Card>
        );
    }
    
    if (error) {
         return (
            <Card>
                <CardHeader>
                    <CardTitle>Ошибка загрузки заявок</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-destructive">{error.message}</p>
                </CardContent>
            </Card>
        );
    }

    if (!pendingSupplies || pendingSupplies.length === 0) {
        return null; 
    }
    
    const filteredSupplies = pendingSupplies.filter((s: any) => s.status === 'pending');

    if (filteredSupplies.length === 0) {
        return null;
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Ожидают подтверждения</CardTitle>
                <CardDescription>Заявки на поставку, требующие вашего одобрения.</CardDescription>
            </CardHeader>
            <CardContent>
                <Accordion type="multiple" className="w-full space-y-4">
                    {filteredSupplies.map((supply: any) => {
                         const totalSum = supply.ingredients.reduce((acc: number, ing: any) => acc + Number(ing.price), 0);
                         return (
                            <AccordionItem value={supply.id} key={supply.id} className="border rounded-md px-4">
                                <AccordionTrigger>
                                    <div className="flex justify-between w-full pr-4 text-sm">
                                        <div className="flex flex-col text-left">
                                            <span className="font-semibold">{dataMap.suppliers.get(String(supply.supplier_id)) || `Поставщик #${supply.supplier_id}`}</span>
                                            <span className="text-xs text-muted-foreground">{supply.requesterName}</span>
                                        </div>
                                        <div className="flex flex-col text-right">
                                            <span>{new Intl.NumberFormat('uz-UZ').format(totalSum)} сум</span>
                                            <span className="text-xs text-muted-foreground">{supply.createdAt ? format(supply.createdAt.toDate(), 'dd.MM.yy HH:mm') : '-'}</span>
                                        </div>
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent>
                                    <div className="space-y-4 pt-2">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Ингредиент</TableHead>
                                                    <TableHead>Кол-во</TableHead>
                                                    <TableHead className="text-right">Сумма</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {supply.ingredients.map((ing: any) => {
                                                    const ingredientDetails = ingredients.find(i => i.id === String(ing.ingredient_id));
                                                    return (
                                                        <TableRow key={ing.ingredient_id}>
                                                            <TableCell>{dataMap.ingredients.get(String(ing.ingredient_id)) || `Ингредиент #${ing.ingredient_id}`}</TableCell>
                                                            <TableCell>{ing.count} {ingredientDetails ? translateUnit(ingredientDetails.unit) : ''}</TableCell>
                                                            <TableCell className="text-right">{formatNumberString(String(ing.price))} сум</TableCell>
                                                        </TableRow>
                                                    )
                                                })}
                                            </TableBody>
                                        </Table>
                                        <div className="text-sm text-muted-foreground">
                                            <span className="font-medium">Комментарий:</span> {supply.comment}
                                        </div>
                                        <div className="flex justify-end gap-2">
                                            <Button size="sm" onClick={() => handleApprove(supply)}>Одобрить</Button>
                                            <Button size="sm" variant="destructive" onClick={() => handleReject(supply.id)}>Отклонить</Button>
                                        </div>
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                         )
                    })}
                </Accordion>
            </CardContent>
        </Card>
    );
}
