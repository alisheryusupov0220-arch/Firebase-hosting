import Link from 'next/link';
import { getPendingInventoryTasksAction, type InventoryTask } from './actions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { FilePenLine } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function InventoryTasksPage() {
    const tasks = await getPendingInventoryTasksAction();

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
