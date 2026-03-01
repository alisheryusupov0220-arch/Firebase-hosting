'use client';

import { useEffect, useState } from 'react';
import { useUser, useDoc, useFirestore } from '@/firebase/hooks';
import { getInventoryHistoryAction, type InventoryCountHistoryItem } from '../actions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { translateUnit } from '@/lib/utils';
import { Loader2 } from 'lucide-react';
import { doc } from 'firebase/firestore';
import { useMemoFirebase } from '@/firebase/provider';

export const dynamic = 'force-dynamic';

function groupCountsByDay(counts: InventoryCountHistoryItem[]): Record<string, InventoryCountHistoryItem[]> {
    return counts.reduce((acc, count) => {
        const date = format(new Date(count.createdAt.seconds * 1000), 'yyyy-MM-dd');
        if (!acc[date]) {
            acc[date] = [];
        }
        acc[date].push(count);
        return acc;
    }, {} as Record<string, InventoryCountHistoryItem[]>);
}

export default function InventoryHistoryPage() {
    const { user } = useUser();
    const firestore = useFirestore();
    const [history, setHistory] = useState<InventoryCountHistoryItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const userProfileRef = useMemoFirebase(() => {
        if (!firestore || !user?.uid) return null;
        return doc(firestore, 'users', user.uid);
    }, [firestore, user?.uid]);

    const { data: userProfile } = useDoc(userProfileRef);

    useEffect(() => {
        async function loadHistory() {
            setIsLoading(true);
            const historyData = await getInventoryHistoryAction();
            setHistory(historyData);
            setIsLoading(false);
        }
        loadHistory();
    }, []);

    const displayedHistory = userProfile?.role === 'employee' ? history.slice(0, 1) : history;
    const groupedHistory = groupCountsByDay(displayedHistory);
    const sortedDays = Object.keys(groupedHistory).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
    
    if (isLoading) {
        return (
             <div className="flex min-h-[400px] w-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (history.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>История инвентаризаций</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="h-24 flex items-center justify-center text-muted-foreground">
                        Еще не было проведено ни одной инвентаризации.
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>История инвентаризаций</CardTitle>
                <CardDescription>Просмотр ранее сохраненных инвентаризационных актов.</CardDescription>
            </CardHeader>
            <CardContent>
                <Accordion type="single" collapsible className="w-full">
                    {sortedDays.map(day => (
                        <AccordionItem value={day} key={day}>
                            <AccordionTrigger className="text-lg font-medium">
                                {format(new Date(day), 'd MMMM yyyy', { locale: ru })}
                            </AccordionTrigger>
                            <AccordionContent>
                                <div className="space-y-4">
                                    {groupedHistory[day].map(count => (
                                        <div key={count.id} className="border rounded-lg p-4">
                                            <h4 className="font-semibold">{count.comment}</h4>
                                            <p className="text-sm text-muted-foreground">
                                                {count.userName} в {format(new Date(count.createdAt.seconds * 1000), 'HH:mm')}
                                            </p>
                                            <Table className="mt-2">
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead>Ингредиент</TableHead>
                                                        <TableHead className="text-right">Количество</TableHead>
                                                        <TableHead>Ед. изм.</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {count.items.map(item => (
                                                        <TableRow key={item.ingredientId}>
                                                            <TableCell>{item.ingredientName}</TableCell>
                                                            <TableCell className="text-right font-mono">{item.quantity}</TableCell>
                                                            <TableCell>{translateUnit(item.unit)}</TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    ))}
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                    ))}
                </Accordion>
            </CardContent>
        </Card>
    );
}
