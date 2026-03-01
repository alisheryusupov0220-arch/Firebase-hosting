'use client';

import React, { useState, useEffect, useTransition } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/firebase/hooks';
import { saveInventoryTemplateAction, getInventoryTemplatesAction, type InventoryTemplate } from '../actions';
import { Loader2, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

export default function InventoryTemplatesPage() {
    const { toast } = useToast();
    const { user } = useUser();
    const [isSaving, startSavingTransition] = useTransition();

    const [templates, setTemplates] = useState<InventoryTemplate[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [type, setType] = useState<'full' | 'partial'>('full');

    const fetchTemplates = async () => {
        setIsLoading(true);
        const templatesData = await getInventoryTemplatesAction();
        setTemplates(templatesData);
        setIsLoading(false);
    }

    useEffect(() => {
        fetchTemplates();
    }, []);

    const handleSaveTemplate = () => {
        if (!name.trim()) {
            toast({ variant: 'destructive', title: 'Ошибка', description: 'Введите название шаблона.' });
            return;
        }
        if (!user) {
            toast({ variant: 'destructive', title: 'Ошибка', description: 'Вы должны быть авторизованы.' });
            return;
        }

        startSavingTransition(async () => {
            const result = await saveInventoryTemplateAction({
                name,
                description,
                type,
                userId: user.uid,
                userName: user.email || 'Unknown User',
            });

            if (result.success) {
                toast({ title: 'Успех!', description: result.message });
                setName('');
                setDescription('');
                setType('full');
                // Refresh list
                await fetchTemplates();
            } else {
                toast({ variant: 'destructive', title: 'Ошибка сохранения', description: result.message });
            }
        });
    };
    
    const handleStartInventory = (template: InventoryTemplate) => {
        // This is where the logic to create an InventoryTask would go.
        // For now, it will just show a toast.
        toast({
            title: 'Функция в разработке',
            description: `Запуск инвентаризации по шаблону "${template.name}" скоро будет доступен.`,
        });
    };

    return (
        <div className="grid gap-6 md:grid-cols-2">
            <Card>
                <CardHeader>
                    <CardTitle>Создать новый шаблон</CardTitle>
                    <CardDescription>Шаблоны используются для запуска новых инвентаризаций.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="template-name">Название</Label>
                        <Input 
                            id="template-name"
                            placeholder="Напр., Еженедельная проверка бара"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                        />
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="template-description">Описание</Label>
                        <Textarea
                            id="template-description"
                            placeholder="Краткое описание назначения шаблона"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                         />
                    </div>
                    <div className="space-y-2">
                        <Label>Тип инвентаризации</Label>
                        <RadioGroup value={type} onValueChange={(v: any) => setType(v)} className="flex items-center gap-4">
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="full" id="type-full" />
                                <Label htmlFor="type-full">Полная</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="partial" id="type-partial" />
                                <Label htmlFor="type-partial">Частичная</Label>
                            </div>
                        </RadioGroup>
                         <p className="text-xs text-muted-foreground pt-1">
                            При частичной инвентаризации нужно будет выбрать конкретные ингредиенты (эта функция в разработке).
                         </p>
                    </div>
                    <Button onClick={handleSaveTemplate} disabled={isSaving}>
                        {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Создать шаблон
                    </Button>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Существующие шаблоны</CardTitle>
                    <CardDescription>Запустите инвентаризацию на основе одного из этих шаблонов.</CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex items-center justify-center h-24">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : templates.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-10">Шаблоны еще не созданы.</p>
                    ) : (
                        <div className="space-y-4">
                            {templates.map(template => (
                                <div key={template.id} className="flex items-center justify-between rounded-lg border p-4">
                                    <div>
                                        <p className="font-semibold">{template.name}</p>
                                        <p className="text-sm text-muted-foreground">
                                            {template.type === 'full' ? 'Полная' : 'Частичная'} | Создан: {format(template.createdAt.seconds * 1000, 'dd MMM yyyy', { locale: ru })}
                                        </p>
                                    </div>
                                    <Button size="sm" variant="outline" onClick={() => handleStartInventory(template)}>
                                        <Plus className="mr-2 h-4 w-4"/>
                                        Начать
                                    </Button>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
