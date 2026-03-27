'use client';

import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Trash, PlusCircle, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useMemo } from 'react';
import { useUser, useCollection, useFirestore } from '@/firebase/hooks';
import { collection, query, orderBy } from 'firebase/firestore';
import { useMemoFirebase } from '@/firebase/provider';
import { SearchableSelect } from '../ui/searchable-select';
import { formatNumberString, parseFormattedNumber, translateUnit } from '@/lib/utils';
import { type Storage } from '@/lib/poster';
import { processSupplyAction } from '@/app/actions/flow-core';
import { ERPItem, Supplier } from '@/lib/types/erp';
import { cn } from '@/lib/utils';

const formSchema = z.object({
  supplier_id: z.string().min(1, 'Нужно выбрать поставщика'),
  storage_id: z.string().min(1, 'Нужно выбрать склад'),
  comment: z.string().optional(),
  ingredients: z.array(z.object({
    item_id: z.string().min(1, 'Нужно выбрать товар'),
    count: z.string().min(1, 'Введите кол-во').refine(val => parseFormattedNumber(val) > 0, { message: 'Кол-во > 0'}),
    price: z.string().min(1, 'Введите сумму').refine(val => parseFormattedNumber(val) >= 0, { message: 'Сумма >= 0'}),
  })).min(1, 'Нужно добавить хотя бы одну позицию'),
});

type CreateSupplyFormValues = z.infer<typeof formSchema>;

export function CreateSupplyForm({ storages, onFormSubmitted }: { storages: Storage[], onFormSubmitted: () => void }) {
  const { toast } = useToast();
  const { user } = useUser();
  const firestore = useFirestore();

  const itemsQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'erp_items'), orderBy('name', 'asc')) : null, [firestore]);
  const suppliersQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'suppliers'), orderBy('name', 'asc')) : null, [firestore]);

  const { data: erpItems } = useCollection<ERPItem & { id: string }>(itemsQuery);
  const { data: localSuppliers } = useCollection<Supplier>(suppliersQuery);

  const form = useForm<CreateSupplyFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      supplier_id: '',
      storage_id: '',
      comment: '',
      ingredients: [{ item_id: '', count: '', price: '' }],
    },
  });

  const itemOptions = useMemo(() => (erpItems || []).map(item => ({ value: item.id, label: item.name })), [erpItems]);
  const supplierOptions = useMemo(() => (localSuppliers || []).map(s => ({ value: s.id, label: s.name })), [localSuppliers]);
  const storageOptions = useMemo(() => (storages || []).map(s => ({ value: String(s.storage_id), label: s.storage_name })), [storages]);

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'ingredients',
  });

  const watchedIngredients = form.watch('ingredients');

  async function onSubmit(values: CreateSupplyFormValues) {
    if (!user) return;
    const posterData: any = {
        supplier_id: Number(localSuppliers?.find(s => s.id === values.supplier_id)?.posterId),
        storage_id: Number(values.storage_id),
        comment: values.comment || '',
        ingredients: values.ingredients.map(ing => {
            const item = erpItems?.find(i => i.id === ing.item_id);
            return {
                ingredient_id: Number(item?.posterId),
                count: parseFormattedNumber(ing.count),
                price: parseFormattedNumber(ing.price),
                type: item?.type === 'SEMI_FINISHED' ? 3 : 1, // Poster type
                unit: item?.baseUnit
            };
        })
    };
    const result = await processSupplyAction(posterData, user.uid);
    if (result.success) {
        toast({ title: 'Принято!', description: 'Поставка проведена в системе FLOW и Poster.' });
        onFormSubmitted();
        form.reset();
    } else {
        toast({ variant: 'destructive', title: 'Ошибка', description: result.message });
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="supplier_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Поставщик (FLOW)</FormLabel>
                  <FormControl>
                    <SearchableSelect options={supplierOptions} value={field.value} onChange={field.onChange} placeholder="Кто привез?" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="storage_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Склад (Poster Master)</FormLabel>
                  <FormControl>
                    <SearchableSelect options={storageOptions} value={field.value} onChange={field.onChange} placeholder="Куда привез?" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
        </div>

        <div className="space-y-2">
            {fields.map((field, index) => {
                const selectedItemId = watchedIngredients[index]?.item_id;
                const erpItem = erpItems?.find(i => i.id === selectedItemId);
                
                const count = parseFormattedNumber(watchedIngredients[index]?.count || '0');
                const totalPrice = parseFormattedNumber(watchedIngredients[index]?.price || '0');
                const currentPricePerUnit = count > 0 ? totalPrice / count : 0;
                
                // Smart Validation (Price Deviation)
                const lastPrice = erpItem?.lastPurchasePrice || 0;
                const priceDeviation = lastPrice > 0 ? (Math.abs(currentPricePerUnit - lastPrice) / lastPrice) * 100 : 0;
                const isPriceSuspicious = priceDeviation > 30; // Threshold: 30% deviation

                return (
                    <div key={field.id} className={cn(
                        "grid grid-cols-[1fr_auto_auto_auto] items-start gap-2 p-2 border rounded-md transition-colors",
                        isPriceSuspicious ? "bg-amber-50 border-amber-200" : ""
                    )}>
                        <FormField
                          control={form.control}
                          name={`ingredients.${index}.item_id`}
                          render={({ field }) => (
                            <FormItem className="flex-1">
                              <FormControl>
                                <SearchableSelect options={itemOptions} value={field.value} onChange={field.onChange} placeholder="Выберите товар" />
                              </FormControl>
                              {erpItem && lastPrice > 0 && (
                                <div className="text-[10px] mt-1 text-muted-foreground flex items-center gap-1">
                                    {isPriceSuspicious ? <AlertTriangle className="h-3 w-3 text-amber-500" /> : <CheckCircle2 className="h-3 w-3 text-green-500" />}
                                    Пред. цена: {lastPrice.toLocaleString()} сум / {translateUnit(erpItem.baseUnit)}
                                </div>
                              )}
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                            control={form.control}
                            name={`ingredients.${index}.count`}
                            render={({ field }) => (
                                <FormItem>
                                    <FormControl><Input {...field} placeholder="Кол-во" className="w-24 text-right" /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name={`ingredients.${index}.price`}
                            render={({ field }) => (
                                <FormItem>
                                    <FormControl>
                                        <Input 
                                            {...field} 
                                            placeholder="Сумма" 
                                            className={cn("w-24 text-right", isPriceSuspicious && "ring-2 ring-amber-500 focus-visible:ring-amber-500")}
                                            onChange={(e) => field.onChange(formatNumberString(e.target.value))} 
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} disabled={fields.length <= 1} className="mt-1">
                            <Trash className="h-4 w-4" />
                        </Button>
                    </div>
                )
            })}
            <Button type="button" variant="outline" size="sm" onClick={() => append({ item_id: '', count: '', price: '' })}>
                <PlusCircle className="mr-2 h-4 w-4" /> Добавить позицию
            </Button>
        </div>

        <FormField
          control={form.control}
          name="comment"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Комментарий (FLOW Audit)</FormLabel>
              <FormControl><Textarea placeholder="Детали для истории (например, номер накладной)..." {...field} /></FormControl>
            </FormItem>
          )}
        />
        
        <Button 
            type="submit" 
            className={cn("w-full transition-all", watchedIngredients.some((_, idx) => {
                const item = erpItems?.find(i => i.id === watchedIngredients[idx]?.item_id);
                const lp = item?.lastPurchasePrice || 0;
                const c = parseFormattedNumber(watchedIngredients[idx]?.count || '0');
                const p = parseFormattedNumber(watchedIngredients[idx]?.price || '0');
                const cppu = c > 0 ? p / c : 0;
                return lp > 0 && (Math.abs(cppu - lp) / lp) * 100 > 30;
            }) ? "bg-amber-600 hover:bg-amber-700" : "bg-primary")} 
            disabled={form.formState.isSubmitting}
        >
          {form.formState.isSubmitting ? 'Проводим...' : 'Провести поставку'}
        </Button>
        {watchedIngredients.some((_, idx) => {
            const item = erpItems?.find(i => i.id === watchedIngredients[idx]?.item_id);
            const lp = item?.lastPurchasePrice || 0;
            const c = parseFormattedNumber(watchedIngredients[idx]?.count || '0');
            const p = parseFormattedNumber(watchedIngredients[idx]?.price || '0');
            const cppu = c > 0 ? p / c : 0;
            return lp > 0 && (Math.abs(cppu - lp) / lp) * 100 > 30;
        }) && (
            <p className="text-[11px] text-amber-700 text-center animate-pulse">
                Внимание: у некоторых позиций цена сильно отличается от обычной! Проверьте данные.
            </p>
        )}
      </form>
    </Form>
  );
}
