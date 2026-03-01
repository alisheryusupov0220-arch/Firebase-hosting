'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/firebase/hooks';
import type { LocalIngredient } from '@/app/ingredients/actions';
import { getTaskWithIngredients, saveInventoryCountAction } from '@/app/inventory/actions';
import { Loader2 } from 'lucide-react';
import { translateUnit } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useRouter, useParams } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function ConductInventoryPage() {
    const params = useParams();
    const taskId = params.taskId as string;
    const router = useRouter();
    const { toast } = useToast();
    const { user } = useUser();
    const [taskIngredients, setTaskIngredients] = useState<LocalIngredient[]>([]);
    const [templateName, setTemplateName] = useState('');
    const [quantities, setQuantities] = useState<Record<string, string>>({});
    const [comment, setComment] = useState('');
    const [filter, setFilter] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        async function loadTask() {
            if (!taskId) return;
            setIsLoading(true);
            const data = await getTaskWithIngredients(taskId);
            if (data) {
                if (data.task.status === 'completed') {
                    toast({ variant: 'destructive', title: 'Ошибка', description: 'Это задание уже выполнено.' });
                    router.push('/inventory');
                    return;
                }
                setTaskIngredients(data.ingredients);
                setTemplateName(data.task.templateName);
                setComment(data.task.templateName); // Pre-fill comment with template name
            } else {
                toast({ variant: 'destructive', title: 'Ошибка', description: 'Задание на инвентаризацию не найдено.' });
                router.push('/inventory');
            }
            setIsLoading(false);
        }
        loadTask();
    }, [taskId, router, toast]);

    const handleQuantityChange = (ingredientId: string, value: string) => {
        setQuantities(prev => ({ ...prev, [ingredientId]: value }));
    };

    const filteredIngredients = useMemo(() => {
        if (!filter) {
            return taskIngredients;
        }
        return taskIngredients.filter(ing =>
            ing.name.toLowerCase().includes(filter.toLowerCase())
        );
    }, [taskIngredients, filter]);

    const isUnitBased = (unit: string) => {
        const translated = translateUnit(unit);
        return translated === 'штук';
    };

    const getInputAttributes = (unit: string) => {
        if (isUnitBased(unit)) {
            return { placeholder: '1, 2, 3...', step: '1', pattern: '\\d*' };
        }
        return { placeholder: '1.123', step: '0.001' };
    };

    const allVisibleItemsFilled = useMemo(() => {
        if (filteredIngredients.length === 0) return false;
        return filteredIngredients.every(ing => {
            const quantityStr = quantities[ing.id];
            if (quantityStr === undefined || quantityStr === '') return false;
            const quantity = parseFloat(quantityStr);
            return !isNaN(quantity) && quantity >= 0;
        });
    }, [filteredIngredients, quantities]);

    const handleSave = async () => {
        if (!comment.trim()) {
            toast({ variant: 'destructive', title: 'Ошибка', description: 'Пожалуйста, введите комментарий или название инвентаризации.' });
            return;
        }

        if (!user) {
            toast({ variant: 'destructive', title: 'Ошибка', description: 'Для сохранения вы должны быть авторизованы.' });
            return;
        }
        
        const itemsToSave = filteredIngredients
            .map(ingredient => {
                const quantityStr = quantities[ingredient.id];
                if (quantityStr === '' || quantityStr === undefined) return null;
                
                const quantity = parseFloat(quantityStr);
                if (isNaN(quantity) || quantity < 0) return null;

                return {
                    ingredientId: ingredient.id,
                    ingredientName: ingredient.name,
                    unit: ingredient.unit,
                    quantity: quantity,
                };
            })
            .filter((item): item is NonNullable<typeof item> => item !== null);
        
        if (itemsToSave.length !== filteredIngredients.length) {
            toast({ variant: 'destructive', title: 'Не все поля заполнены', description: 'Заполните количество для всех отображенных позиций (можно вводить 0).' });
            return;
        }

        setIsSaving(true);
        if (!taskId) return;
        const result = await saveInventoryCountAction({
            taskId: taskId,
            comment,
            items: itemsToSave,
            userId: user.uid,
            userName: user.email || 'Unknown User',
        });
        setIsSaving(false);

        if (result.success) {
            toast({ title: 'Успех!', description: 'Данные инвентаризации сохранены.' });
            router.push('/inventory');
        } else {
            toast({ variant: 'destructive', title: 'Ошибка сохранения', description: result.message });
        }
    };

    if (isLoading) {
        return <div className="flex min-h-[400px] w-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
    }
    
    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Проведение: {templateName}</CardTitle>
                    <CardDescription>
                        Введите название (например, &quot;Еженедельная проверка бара&quot;), отфильтруйте список при необходимости,
                        и заполните фактическое количество для всех видимых позиций.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Input
                        placeholder="* Обязательный комментарий или название инвентаризации..."
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        className="max-w-lg"
                    />
                    <Input
                        placeholder="Поиск по списку..."
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                        className="max-w-lg"
                    />
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Список ингредиентов</CardTitle>
                     <CardDescription>
                        Для сохранения необходимо заполнить количество для всех позиций в текущем списке.
                     </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Название ингредиента</TableHead>
                                    <TableHead className="w-[100px]">Ед. изм.</TableHead>
                                    <TableHead className="w-[220px] text-right">Фактическое кол-во</TableHead>
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
                                                    {...getInputAttributes(ing.unit)}
                                                    type="number"
                                                    value={quantities[ing.id] || ''}
                                                    onChange={(e) => handleQuantityChange(ing.id, e.target.value)}
                                                    className="text-right"
                                                    min="0"
                                                />
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={3} className="h-24 text-center">
                                            Ингредиенты для этого задания не найдены.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                    <div className="mt-6 flex justify-end">
                       <TooltipProvider>
                         <Tooltip>
                           <TooltipTrigger asChild>
                             <div tabIndex={0}> 
                                <Button onClick={handleSave} disabled={isSaving || !allVisibleItemsFilled || !comment.trim()}>
                                    {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Сохранить инвентаризацию
                                </Button>
                              </div>
                           </TooltipTrigger>
                           {(!allVisibleItemsFilled || !comment.trim()) && (
                             <TooltipContent>
                               <p>Заполните комментарий и количество для всех видимых позиций.</p>
                             </TooltipContent>
                           )}
                         </Tooltip>
                       </TooltipProvider>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
