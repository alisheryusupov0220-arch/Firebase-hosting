'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { type Storage, type StorageBalanceItem } from '@/lib/poster';
import { getBalanceForStorage, getLatestPrices, fetchStoragesAction } from './actions';


export const dynamic = 'force-dynamic';

type EnrichedBalanceItem = StorageBalanceItem & {
    latestPrice: number;
    actual?: number;
};

export default function InventoryPage() {
    const [storages, setStorages] = useState<Storage[]>([]);
    const [selectedStorage, setSelectedStorage] = useState<string>('');
    const [balanceItems, setBalanceItems] = useState<EnrichedBalanceItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [loadingStorages, setLoadingStorages] = useState(true);

    useEffect(() => {
        const loadStorages = async () => {
            setLoadingStorages(true);
            const fetchedStorages = await fetchStoragesAction();
            setStorages(fetchedStorages);
            setLoadingStorages(false);
        }
        loadStorages();
    }, [])

    useEffect(() => {
        if (!selectedStorage) {
            setBalanceItems([]);
            return;
        };

        const fetchBalanceAndPrices = async () => {
            setLoading(true);
            try {
                const balance = await getBalanceForStorage(selectedStorage);
                const ingredientIds = balance.map(item => item.ingredient_id);
                if (ingredientIds.length > 0) {
                    const prices = await getLatestPrices(ingredientIds);
                    const enrichedItems = balance.map(item => ({
                        ...item,
                        latestPrice: prices[item.ingredient_id] || 0,
                    }));
                    setBalanceItems(enrichedItems);
                } else {
                    setBalanceItems([]);
                }
            } catch (error) {
                console.error("Failed to fetch inventory data:", error);
                // Here you would show a toast to the user
            }
            setLoading(false);
        };

        fetchBalanceAndPrices();
    }, [selectedStorage]);

    const handleActualChange = (ingredientId: string, value: string) => {
        const numericValue = value === '' ? undefined : parseFloat(value);
        setBalanceItems(prev =>
            prev.map(item =>
                item.ingredient_id === ingredientId ? { ...item, actual: numericValue } : item
            )
        );
    };

    const totalLoss = useMemo(() => {
        return balanceItems.reduce((acc, item) => {
            if (item.actual !== undefined) {
                const plan = parseFloat(item.balance);
                const diff = item.actual - plan;
                if (diff < 0) {
                    const loss = -diff * item.latestPrice;
                    return acc + loss;
                }
            }
            return acc;
        }, 0);
    }, [balanceItems]);

    return (
        <div className="space-y-6">
            <PageHeader title="Инвентаризация" description="Проведение инвентаризаций для обновления остатков." />

            <Card>
                <CardHeader>
                    <CardTitle>Выбор склада</CardTitle>
                    <CardDescription>Выберите склад для проведения инвентаризации.</CardDescription>
                </CardHeader>
                <CardContent>
                    {loadingStorages ? (
                        <p>Загрузка складов...</p>
                    ) : (
                        <Select value={selectedStorage} onValueChange={setSelectedStorage}>
                            <SelectTrigger className="w-[280px]">
                                <SelectValue placeholder="Выберите склад..." />
                            </SelectTrigger>
                            <SelectContent>
                                {storages.map(storage => (
                                    <SelectItem key={storage.storage_id} value={storage.storage_id}>
                                        {storage.storage_name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                </CardContent>
            </Card>

            {selectedStorage && (
                 <Card>
                    <CardHeader>
                        <CardTitle>Проведение инвентаризации</CardTitle>
                         <CardDescription>
                            Введите фактические остатки. Разница будет рассчитана автоматически.
                         </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <p>Загрузка данных...</p>
                        ) : balanceItems.length > 0 ? (
                           <>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Ингредиент</TableHead>
                                        <TableHead className="text-right">План (Poster)</TableHead>
                                        <TableHead className="w-[150px] text-right">Факт</TableHead>
                                        <TableHead className="text-right">Разница</TableHead>
                                        <TableHead className="text-right">Потери (в деньгах)</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {balanceItems.map(item => {
                                        const plan = parseFloat(item.balance);
                                        const actual = item.actual;
                                        const difference = actual !== undefined ? actual - plan : undefined;
                                        const loss = difference !== undefined && difference < 0 ? -difference * item.latestPrice : 0;
                                        
                                        return (
                                            <TableRow key={item.ingredient_id}>
                                                <TableCell>{item.ingredient_name}</TableCell>
                                                <TableCell className="text-right">{plan.toFixed(3)} {item.unit}</TableCell>
                                                <TableCell className="text-right">
                                                    <Input
                                                        type="number"
                                                        value={actual ?? ''}
                                                        onChange={(e) => handleActualChange(item.ingredient_id, e.target.value)}
                                                        className="text-right"
                                                    />
                                                </TableCell>
                                                <TableCell className={`text-right font-medium ${difference === undefined ? '' : difference < 0 ? 'text-red-500' : 'text-green-500'}`}>
                                                    {difference !== undefined ? difference.toFixed(3) : '-'}
                                                </TableCell>
                                                <TableCell className="text-right font-medium text-red-500">
                                                    {loss > 0 ? new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' }).format(loss) : '-'}
                                                </TableCell>
                                            </TableRow>
                                        )
                                    })}
                                </TableBody>
                            </Table>
                             <div className="mt-4 text-right">
                                <p className="text-lg font-bold">
                                    Общие потери: {new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' }).format(totalLoss)}
                                </p>
                            </div>
                           </>
                        ) : (
                            <p>На этом складе нет остатков.</p>
                        )}
                    </CardContent>
                 </Card>
            )}
        </div>
    );
}
