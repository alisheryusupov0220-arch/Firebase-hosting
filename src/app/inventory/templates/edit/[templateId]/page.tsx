'use client';

import React, { useState, useEffect, useTransition } from 'react';
import { getDoc, doc } from 'firebase/firestore';
import { useFirestore } from '@/firebase/hooks';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getIngredientsForInventory, updateTemplateIngredientsAction, type InventoryTemplate } from '@/app/inventory/actions';
import type { LocalIngredient } from '@/app/ingredients/actions';

export default function EditInventoryTemplatePage({ params }: { params: { templateId: string } }) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [template, setTemplate] = useState<InventoryTemplate | null>(null);
    const [allIngredients, setAllIngredients] = useState<LocalIngredient[]>([]);
    const [selectedIngredients, setSelectedIngredients] = useState<Set<string>>(new Set());
    const [filter, setFilter] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, startSavingTransition] = useTransition();

    useEffect(() => {
        async function fetchData() {
            if (!firestore) return;
            setIsLoading(true);

            try {
                const templateRef = doc(firestore, 'inventory_templates', params.templateId);
                const templateSnap = await getDoc(templateRef);

                if (!templateSnap.exists() || templateSnap.data().type !== 'partial') {
                    return notFound();
                }
                
                const templateData = { id: templateSnap.id, ...templateSnap.data() } as InventoryTemplate;
                setTemplate(templateData);
                setSelectedIngredients(new Set(templateData.ingredientIds || []));

                const ingredientsData = await getIngredientsForInventory();
                setAllIngredients(ingredientsData);
            } catch (error) {
                console.error("Failed to fetch template data:", error);
                toast({ variant: "destructive", title: "Ошибка загрузки", description: "Не удалось загрузить данные шаблона." });
            } finally {
                setIsLoading(false);
            }
        }

        fetchData();
    }, [firestore, params.templateId, toast]);

    const handleSelect = (ingredientId: string, checked: boolean) => {
        setSelectedIngredients(prev => {
            const newSet = new Set(prev);
            if (checked) {
                newSet.add(ingredientId);
            } else {
                newSet.delete(ingredientId);
            }
            return newSet;
        });
    };

    const handleSave = () => {
        startSavingTransition(async () => {
            const result = await updateTemplateIngredientsAction(params.templateId, Array.from(selectedIngredients));
            if (result.success) {
                toast({ title: 'Успех!', description: 'Шаблон обновлен.' });
            } else {
                toast({ variant: 'destructive', title: 'Ошибка', description: result.message });
            }
        });
    };

    const filteredIngredients = allIngredients.filter(ing => 
        ing.name.toLowerCase().includes(filter.toLowerCase())
    );

    if (isLoading) {
        return <div className="flex min-h-[400px] w-full items-center justify-center">
                   <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
               </div>;
    }

    if (!template) {
        return null; // notFound() would have been called
    }

    return (
        <div className="space-y-6">
            <PageHeader title={`Настройка: ${template.name}`} description="Выберите ингредиенты для этой частичной инвентаризации." />
            
            <Card>
                <CardHeader>
                    <CardTitle>Список ингредиентов</CardTitle>
                    <CardDescription>Отметьте галочкой те позиции, которые должны входить в этот шаблон.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Input 
                        placeholder="Поиск ингредиентов..."
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                        className="max-w-lg"
                    />
                    <div className="space-y-2 max-h-96 overflow-y-auto pr-4 border rounded-md p-2">
                        {filteredIngredients.map(ing => (
                            <div key={ing.id} className="flex items-center space-x-2 rounded-md p-2 hover:bg-accent">
                                <Checkbox
                                    id={`ing-${ing.id}`}
                                    checked={selectedIngredients.has(ing.id)}
                                    onCheckedChange={(checked) => handleSelect(ing.id, !!checked)}
                                />
                                <label htmlFor={`ing-${ing.id}`} className="text-sm font-medium leading-none cursor-pointer flex-1">
                                    {ing.name}
                                </label>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            <div className="flex justify-end">
                <Button onClick={handleSave} disabled={isSaving}>
                    {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Сохранить изменения
                </Button>
            </div>
        </div>
    );
}
