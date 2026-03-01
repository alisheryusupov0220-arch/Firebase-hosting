'use client';

import React from 'react';
import { useCollection, useFirestore, useUser } from '@/firebase/hooks';
import { collection, query, where } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { approveWriteOffAction, rejectWriteOffAction } from '@/app/write-offs/actions';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import type { LocalIngredient } from '@/app/ingredients/actions';
import type { Storage } from '@/lib/poster';
import { useMemoFirebase } from '@/firebase/provider';
import { Skeleton } from '../ui/skeleton';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"

type PendingWriteOffsCardProps = {
    storages: Storage[];
    ingredients: LocalIngredient[];
};


export function PendingWriteOffsCard({ storages, ingredients }: PendingWriteOffsCardProps) {
    const { toast } = useToast();
    const { user } = useUser();
    const firestore = useFirestore();
    
    const pendingWriteOffsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'pendingWriteOffs'), where('status', '==', 'pending'));
    }, [firestore]);

    const { data: pendingWriteOffs, isLoading, error } = useCollection(pendingWriteOffsQuery);
    
    const dataMap = React.useMemo(() => ({
        storages: new Map(storages.map(item => [item.storage_id, item.storage_name])),
        ingredients: new Map(ingredients.map(item => [item.id, item.name])),
    }), [storages, ingredients]);

    const handleApprove = async (id: string) => {
        if (!user || !user.email) return;
        const result = await approveWriteOffAction(id, user.email);
        if (result.success) {
            toast({ title: 'Успех!', description: 'Списание одобрено и отправлено в Poster.' });
        } else {
            toast({ variant: 'destructive', title: 'Ошибка!', description: result.message });
        }
    };

    const handleReject = async (id: string) => {
        if (!user || !user.email) return;
        const result = await rejectWriteOffAction(id, user.email);
        if (result.success) {
            toast({ title: 'Успех!', description: 'Заявка на списание отклонена.' });
        } else {
            toast({ variant: 'destructive', title: 'Ошибка!', description: result.message });
        }
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
                    <CardTitle>Ошибка загрузки заявок на списание</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-destructive">{error.message}</p>
                </CardContent>
            </Card>
        );
    }

    if (!pendingWriteOffs || pendingWriteOffs.length === 0) {
        return null; 
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Списания: ожидают подтверждения</CardTitle>
                <CardDescription>Заявки на списание, требующие вашего одобрения.</CardDescription>
            </CardHeader>
            <CardContent>
                <Accordion type="multiple" className="w-full space-y-4">
                    {pendingWriteOffs.map((wo: any) => (
                        <AccordionItem value={wo.id} key={wo.id} className="border rounded-md px-4">
                            <AccordionTrigger>
                               <div className="flex justify-between w-full pr-4">
                                 <span>{wo.comment.split('.')[0]}</span>
                                 <span className="text-muted-foreground">
                                    {wo.createdAt ? format(wo.createdAt.toDate(), 'dd.MM.yyyy') : '-'}
                                 </span>
                               </div>
                            </AccordionTrigger>
                            <AccordionContent>
                                <div className="space-y-4">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Ингредиент</TableHead>
                                                <TableHead className="text-right">Количество</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {wo.ingredients.map((ing: any) => (
                                                <TableRow key={ing.ingredient_id}>
                                                    <TableCell>{dataMap.ingredients.get(String(ing.ingredient_id)) || ing.ingredient_id}</TableCell>
                                                    <TableCell className="text-right">{ing.quantity}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                    <div className="flex justify-end gap-2">
                                        <Button size="sm" onClick={() => handleApprove(wo.id)}>Одобрить</Button>
                                        <Button size="sm" variant="outline" onClick={() => handleReject(wo.id)}>Отклонить</Button>
                                    </div>
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                    ))}
                </Accordion>
            </CardContent>
        </Card>
    );
}