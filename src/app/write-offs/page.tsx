'use client';

import React, { useState, useEffect } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import * as z from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Form, FormField, FormItem, FormMessage, FormControl, FormLabel } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { type Storage, type StorageBalanceItem } from '@/lib/poster';
import { getBalanceForStorage, fetchStoragesAction } from '@/app/inventory/actions'; // Reusing actions
import { createWriteOffAction } from './actions';

// Schema for the form
const writeOffSchema = z.object({
  storage_id: z.string().min(1, 'Нужно выбрать склад'),
  comment: z.string().optional(),
  ingredients: z.array(z.object({
    ingredient_id: z.string(),
    ingredient_name: z.string(),
    unit: z.string(),
    max_quantity: z.number(),
    quantity: z.coerce.number().min(0, 'Количество не может быть отрицательным').optional(),
  })).refine(items => items.some(item => item.quantity && item.quantity > 0), {
    message: 'Добавьте хотя бы один ингредиент для списания.',
    path: ['root'],
  }),
});

export default function WriteOffsPage() {
  const { toast } = useToast();
  const [storages, setStorages] = useState<Storage[]>([]);
  const [selectedStorage, setSelectedStorage] = useState<string>('');
  const [balanceItems, setBalanceItems] = useState<StorageBalanceItem[]>([]);
  const [loadingStorages, setLoadingStorages] = useState(true);
  const [loadingBalance, setLoadingBalance] = useState(false);

  const form = useForm<z.infer<typeof writeOffSchema>>({
    resolver: zodResolver(writeOffSchema),
    defaultValues: {
      storage_id: '',
      comment: '',
      ingredients: [],
    },
  });

  const { fields, replace } = useFieldArray({
    control: form.control,
    name: "ingredients",
  });

  // Fetch storages on component mount
  useEffect(() => {
    async function loadStorages() {
      setLoadingStorages(true);
      const fetchedStorages = await fetchStoragesAction();
      setStorages(fetchedStorages);
      setLoadingStorages(false);
    }
    loadStorages();
  }, []);

  // Fetch balance when a storage is selected
  useEffect(() => {
    if (!selectedStorage) {
      setBalanceItems([]);
      replace([]); // Clear form array
      return;
    }

    async function fetchBalance() {
      setLoadingBalance(true);
      const balance = await getBalanceForStorage(selectedStorage);
      setBalanceItems(balance);
      // Populate form array with items from balance
      replace(balance.map(item => ({
        ingredient_id: item.ingredient_id,
        ingredient_name: item.ingredient_name,
        unit: item.unit,
        max_quantity: parseFloat(item.balance),
        quantity: undefined, // Start with empty quantity
      })));
      setLoadingBalance(false);
    }
    fetchBalance();
  }, [selectedStorage, replace]);

  // Handle storage selection change
  const handleStorageChange = (storageId: string) => {
    form.setValue('storage_id', storageId);
    setSelectedStorage(storageId);
  }

  // Form submission handler
  async function onSubmit(values: z.infer<typeof writeOffSchema>) {
    const ingredientsToWriteOff = values.ingredients
      .filter(ing => ing.quantity && ing.quantity > 0)
      .map(ing => ({
        ingredient_id: Number(ing.ingredient_id),
        num: ing.quantity!,
      }));
    
    if (ingredientsToWriteOff.length === 0) {
      form.setError('ingredients.root', { message: 'Добавьте хотя бы один ингредиент для списания.'})
      return;
    }

    const result = await createWriteOffAction({
      storage_id: Number(values.storage_id),
      comment: values.comment || 'Списание из приложения',
      ingredients: ingredientsToWriteOff
    });

    if (result.success) {
      toast({
        title: 'Успех!',
        description: 'Списание успешно создано в Poster.',
      });
      // Reset form and refetch balance
      const currentStorage = selectedStorage;
      form.reset();
      replace([]);
      setSelectedStorage('');
      setTimeout(() => setSelectedStorage(currentStorage), 0);


    } else {
      toast({
        variant: 'destructive',
        title: 'Ошибка!',
        description: result.message || 'Не удалось создать списание.',
      });
    }
  }
  
  return (
    <div className="space-y-6">
      <PageHeader title="Списания" description="Регистрация списаний товаров и отправка данных в Poster." />
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Выбор склада</CardTitle>
              <CardDescription>Выберите склад, с которого будет производиться списание.</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingStorages ? <p>Загрузка складов...</p> : (
                <FormField
                  control={form.control}
                  name="storage_id"
                  render={({ field }) => (
                    <FormItem>
                      <Select value={field.value} onValueChange={handleStorageChange}>
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
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </CardContent>
          </Card>

          {selectedStorage && (
            <Card>
              <CardHeader>
                <CardTitle>Ингредиенты для списания</CardTitle>
                <CardDescription>Укажите количество для каждого списываемого ингредиента.</CardDescription>
              </CardHeader>
              <CardContent>
                {loadingBalance ? <p>Загрузка остатков...</p> : balanceItems.length > 0 ? (
                  <>
                    <div className="space-y-4">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Ингредиент</TableHead>
                            <TableHead className="text-right">Остаток на складе</TableHead>
                            <TableHead className="w-[150px] text-right">Списать (кол-во)</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {fields.map((field, index) => (
                            <TableRow key={field.id}>
                              <TableCell>{field.ingredient_name}</TableCell>
                              <TableCell className="text-right">{field.max_quantity.toFixed(3)} {field.unit}</TableCell>
                              <TableCell className="text-right">
                                <FormField
                                  control={form.control}
                                  name={`ingredients.${index}.quantity`}
                                  render={({ field: inputField }) => (
                                    <FormItem>
                                      <FormControl>
                                        <Input
                                          type="number"
                                          step="0.001"
                                          placeholder="0.000"
                                          className="text-right"
                                          {...inputField}
                                          value={inputField.value ?? ''}
                                          onChange={(e) => {
                                            const val = parseFloat(e.target.value);
                                            const max = fields[index].max_quantity;
                                            if (val > max) {
                                                inputField.onChange(max);
                                            } else {
                                                inputField.onChange(e.target.valueAsNumber || undefined);
                                            }
                                          }}
                                        />
                                      </FormControl>
                                       <FormMessage />
                                    </FormItem>
                                  )}
                                />
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      <FormField
                        control={form.control}
                        name="comment"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Комментарий</FormLabel>
                            <FormControl>
                              <Textarea placeholder="Причина списания..." {...field} />
                            </FormControl>
                             <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                     {form.formState.errors.ingredients?.root && (
                        <p className="text-sm font-medium text-destructive mt-2">{form.formState.errors.ingredients.root.message}</p>
                    )}
                  </>
                ) : (
                  <p>На этом складе нет остатков.</p>
                )}
              </CardContent>
            </Card>
          )}

          {selectedStorage && balanceItems.length > 0 && (
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? 'Отправка...' : 'Создать списание'}
            </Button>
          )}
        </form>
      </Form>
    </div>
  );
}
