'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { getPendingInventoryTasksAction, type InventoryTask } from './actions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { FilePenLine, Loader2 } from 'lucide-react';
import { useFirebase } from '@/firebase/provider';

export default function InventoryTasksPage() {
    const { orgId } = useFirebase();
    const [tasks, setTasks] = useState<InventoryTask[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!orgId) {
            setIsLoading(false);
            return;
        }
        async function loadTasks() {
            setIsLoading(true);
            const data = await getPendingInventoryTasksAction(orgId || undefined);
            setTasks(data);
            setIsLoading(false);
        }
        loadTasks();
    }, [orgId]);

    if (isLoading) {
        return (
             <div className="flex min-h-[400px] w-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Задания на инвентаризацию</CardTitle>
                <CardDescription>Выберите задание, чтобы начать подсчет остатков.</CardDescription>
            </CardHeader>
            <CardContent>
                {tasks.length === 0 ? (
                    <div className="h-40 flex flex-col items-center justify-center text-center text-muted-foreground">
                        <p className="font-medium">Нет активных заданий</p>
                        <p className="text-sm">Новые задания можно создать из раздела "Шаблоны".</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {tasks.map((task) => (
                            <div key={task.id} className="flex items-center justify-between rounded-lg border p-4">
                                <div>
                                    <p className="font-semibold">{task.templateName}</p>
                                    <p className="text-sm text-muted-foreground">
                                        Создано: {task.createdByName} {task.createdAt ? format(new Date(task.createdAt.seconds * 1000), 'dd MMM yyyy HH:mm', { locale: ru }) : ''}
                                    </p>
                                </div>
                                <Button asChild>
                                    <Link href={`/inventory/conduct/${task.id}`}>
                                        <FilePenLine className="mr-2 h-4 w-4" />
                                        Начать подсчет
                                    </Link>
                                </Button>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
