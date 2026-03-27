'use client';

import React, { useEffect, useState, useTransition } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw, TrendingDown, TrendingUp, AlertTriangle } from 'lucide-react';
import { getItemsWithLiveStockAction } from '@/app/actions/flow-sprint1';
import { ERPItem } from '@/lib/types/erp';
import { useToast } from '@/hooks/use-toast';

interface EnrichedItem extends ERPItem {
    liveStock: number;
    posterUnit: string;
}

export default function IngredientsWithStockPage() {
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();
    const [items, setItems] = useState<EnrichedItem[]>([]);
    
    // Default Storage Id (should be from settings in future)
    const activeStorageId = '1'; 

    const fetchData = () => {
        startTransition(async () => {
            const result = await getItemsWithLiveStockAction(activeStorageId);
            if (result.success) {
                setItems(result.items as EnrichedItem[]);
            } else {
                toast({
                    title: "Sync Error",
                    description: result.message,
                    variant: "destructive"
                });
            }
        });
    };

    useEffect(() => {
        fetchData();
    }, []);

    const getStockStatus = (item: EnrichedItem) => {
        if (!item.minStock) return 'normal';
        if (item.liveStock <= item.minStock) return 'low';
        return 'normal';
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-start">
                <PageHeader 
                    title="Товары и Остатки" 
                    description="Синхронизация Min/Max лимитов с реальными остатками Poster."
                />
                <Button onClick={fetchData} disabled={isPending} variant="outline">
                    <RefreshCw className={`mr-2 h-4 w-4 ${isPending ? 'animate-spin' : ''}`} />
                    Обновить данные
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="bg-blue-50/50 border-blue-100">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-medium text-blue-600 uppercase">Всего позиций</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{items.length}</div>
                    </CardContent>
                </Card>
                <Card className="bg-red-50/50 border-red-100 text-red-700">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-medium uppercase">Ниже Min</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {items.filter(i => (i.minStock || 0) >= i.liveStock).length}
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-muted/50">
                                <TableHead className="w-[300px]">Название (FLOW)</TableHead>
                                <TableHead>Poster Stock</TableHead>
                                <TableHead>Min Лимит</TableHead>
                                <TableHead>Max Лимит</TableHead>
                                <TableHead>Статус</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isPending && items.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-32 text-center text-muted-foreground italic">
                                        Синхронизация с Poster API...
                                    </TableCell>
                                </TableRow>
                            )}
                            {items.map((item) => (
                                <TableRow key={item.id} className="hover:bg-muted/30 transition-colors">
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span className="font-medium">{item.name}</span>
                                            <span className="text-[10px] text-muted-foreground font-mono">ID: {item.posterId}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="font-mono font-bold">
                                        {item.liveStock} <span className="text-xs font-normal text-muted-foreground">{item.posterUnit}</span>
                                    </TableCell>
                                    <TableCell className="text-muted-foreground italic">
                                        {item.minStock || '—'}
                                    </TableCell>
                                    <TableCell className="text-muted-foreground italic">
                                        {item.maxStock || '—'}
                                    </TableCell>
                                    <TableCell>
                                        {item.liveStock <= (item.minStock || 0) ? (
                                            <Badge variant="destructive" className="flex items-center gap-1 w-fit">
                                                <TrendingDown className="h-3 w-3" />
                                                Критично
                                            </Badge>
                                        ) : (
                                            <Badge variant="secondary" className="bg-green-100 text-green-700 hover:bg-green-100 border-none flex items-center gap-1 w-fit">
                                                <TrendingUp className="h-3 w-3" />
                                                В норме
                                            </Badge>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
