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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash, PlusCircle, ShoppingBag, LayoutGrid, RefreshCw, CheckCircle2, Truck, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useMemo, useEffect } from 'react';
import { useUser, useCollection, useFirestore } from '@/firebase/hooks';
import { collection, query, orderBy } from 'firebase/firestore';
import { useMemoFirebase, useFirebase } from '@/firebase/provider';
import { SearchableSelect } from '../ui/searchable-select';
import { parseFormattedNumber } from '@/lib/utils';
import { createOrderAction } from '@/app/orders/actions';
import { ERPItem, Contractor, ContractorItem } from '@/lib/types/erp';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';

const orderFormSchema = z.object({
  locationId: z.string().min(1, 'Выберите склад'),
  orderType: z.enum(['PLANNED', 'EMERGENCY']),
  deliveryDate: z.string().optional(),
  reasonForEmergency: z.string().optional(),
  items: z.array(z.object({
    itemId: z.string().min(1, 'Выберите товар'), // Poster Item ID
    contractorId: z.string().optional(), // AUTO-SELECTED but editable
    count: z.string().min(1, 'Введите кол-во').refine(val => parseFormattedNumber(val) > 0, { message: 'Кол-во > 0'}),
    pricePerUnit: z.string().optional(),
    comment: z.string().optional(),
  })).min(1, 'Добавьте хотя бы один товар'),
});

type OrderFormValues = z.infer<typeof orderFormSchema>;

export function CreateOrderForm({ locations, onFormSubmitted }: { 
    locations: { id: string, name: string }[], 
    onFormSubmitted: () => void 
}) {
  const { toast } = useToast();
  const { user } = useUser();
  const { orgId } = useFirebase();
  const firestore = useFirestore();

  // Queries - Unified Architecture
  const itemsQuery = useMemoFirebase(() => {
    if (!firestore || !orgId) return null;
    return query(collection(firestore, 'organizations', orgId, 'erp_items'), orderBy('name', 'asc'));
  }, [firestore, orgId]);

  const contractorsQuery = useMemoFirebase(() => {
    if (!firestore || !orgId) return null;
    return query(collection(firestore, 'organizations', orgId, 'contractors'), orderBy('name', 'asc'));
  }, [firestore, orgId]);

  const contractorItemsQuery = useMemoFirebase(() => {
    if (!firestore || !orgId) return null;
    return query(collection(firestore, 'organizations', orgId, 'contractor_items'), orderBy('updatedAt', 'desc'));
  }, [firestore, orgId]);

  const { data: erpItems } = useCollection<ERPItem & { id: string }>(itemsQuery);
  const { data: contractors } = useCollection<Contractor>(contractorsQuery);
  const { data: allLogistics } = useCollection<ContractorItem>(contractorItemsQuery);

  const form = useForm<OrderFormValues>({
    resolver: zodResolver(orderFormSchema),
    defaultValues: {
      locationId: '',
      orderType: 'PLANNED',
      items: [{ itemId: '', contractorId: '', count: '', pricePerUnit: '', comment: '' }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'items',
  });

  const watchedItems = form.watch('items');

  // Logic: Automagic Routing & Price Match
  const resolveContractorForItem = (posterId: string) => {
      const logistics = (allLogistics || []).filter(l => l.linkedPosterId === posterId);
      if (logistics.length === 0) return null;
      // 1. Check preferred
      const preferred = logistics.find(l => l.isPreferred);
      if (preferred) return preferred;
      // 2. Or just take first
      return logistics[0];
  };

  const getContractorsForItem = (posterId: string) => {
      const links = (allLogistics || []).filter(l => l.linkedPosterId === posterId);
      return (contractors || []).filter(c => links.some(l => l.contractorId === c.id));
  };

  async function onSubmit(values: OrderFormValues) {
    if (!user) return;
    
    const selectedLocation = locations.find(l => l.id === values.locationId);

    // Deep routing before submission
    const apiData = {
        ...values,
        orgId: orgId || undefined,
        locationName: selectedLocation?.name,
        createdBy: user.uid,
        items: values.items.map(item => {
            const posterItem = erpItems?.find(i => i.id === item.itemId);
            const link = (allLogistics || []).find(l => l.contractorId === item.contractorId && l.linkedPosterId === item.itemId);
            const contractor = contractors?.find(c => c.id === item.contractorId);

            return {
                itemId: item.itemId,
                posterId: posterItem?.posterId,
                name: posterItem?.name,
                unit: posterItem?.baseUnit,
                contractorId: item.contractorId,
                contractorName: contractor?.name,
                count: parseFormattedNumber(item.count),
                pricePerUnit: parseFormattedNumber(item.pricePerUnit || String(link?.price || 0)),
                totalPrice: parseFormattedNumber(item.count) * parseFormattedNumber(item.pricePerUnit || String(link?.price || 0))
            };
        })
    };

    const result = await createOrderAction(apiData);
    if (result.success) {
        toast({ title: 'Заявка создана!', description: 'Авто-маршрутизация к поставщикам выполнена.' });
        onFormSubmitted();
        form.reset();
    } else {
        toast({ variant: 'destructive', title: 'Ошибка', description: 'Не удалось создать завявку.' });
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-muted/20 p-6 rounded-[2.5rem]">
            <FormField
              control={form.control}
              name="locationId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] font-black uppercase tracking-widest ml-1">Склад назначения</FormLabel>
                   <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                            <SelectTrigger className="h-14 rounded-2xl bg-white border-none shadow-sm">
                                <SelectValue placeholder="Куда заказываем?" />
                            </SelectTrigger>
                        </FormControl>
                        <SelectContent className="rounded-2xl border-none">
                            {locations.map(l => (
                                <SelectItem key={l.id} value={l.id} className="rounded-xl">{l.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
             <FormField
              control={form.control}
              name="orderType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] font-black uppercase tracking-widest ml-1">Режим заказа</FormLabel>
                   <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className={cn(
                          "h-14 rounded-2xl border-none shadow-sm font-black",
                          field.value === 'EMERGENCY' ? "text-rose-600 bg-rose-50" : "text-emerald-600 bg-emerald-50"
                      )}>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="rounded-2xl border-none">
                      <SelectItem value="PLANNED" className="rounded-xl">📅 Плановый</SelectItem>
                      <SelectItem value="EMERGENCY" className="rounded-xl">🚨 Внеплановый</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />
        </div>

        <div className="space-y-4">
            <div className="flex items-center justify-between px-2">
                <h3 className="text-xs font-black uppercase tracking-[0.2em] flex items-center gap-2">
                    <ShoppingBag className="h-4 w-4" />
                    Список товаров (Poster)
                </h3>
                <Button type="button" variant="outline" size="sm" className="rounded-xl font-black uppercase text-[9px] h-9" onClick={() => append({ itemId: '', contractorId: '', count: '', pricePerUnit: '', comment: '' })}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Добавить строку
                </Button>
            </div>

            {fields.map((field, index) => {
                const selectedItemId = watchedItems[index]?.itemId;
                const link = resolveContractorForItem(selectedItemId);
                const contractorsForThisItem = getContractorsForItem(selectedItemId);

                return (
                    <Card key={field.id} className="rounded-[2rem] border-none shadow-xl bg-card transition-all hover:ring-2 ring-primary/10">
                        <CardContent className="p-6 space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-4 items-start">
                                <FormField
                                    control={form.control}
                                    name={`items.${index}.itemId`}
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormControl>
                                                <SearchableSelect 
                                                    options={(erpItems || []).map(i => ({ value: i.id, label: i.name }))} 
                                                    value={field.value} 
                                                    onChange={(val) => {
                                                        field.onChange(val);
                                                        const autoLink = resolveContractorForItem(val);
                                                        if (autoLink) {
                                                            form.setValue(`items.${index}.contractorId`, autoLink.contractorId);
                                                            form.setValue(`items.${index}.pricePerUnit`, String(autoLink.price));
                                                        }
                                                    }} 
                                                    placeholder="Выберите ингредиент Poster..." 
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name={`items.${index}.count`}
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormControl><Input {...field} placeholder="К-во" className="w-24 h-12 rounded-xl text-center font-black bg-muted/40 border-none" /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <Button type="button" variant="ghost" size="icon" className="h-12 w-12 rounded-xl text-rose-300 hover:text-rose-600 hover:bg-rose-50" onClick={() => remove(index)} disabled={fields.length <= 1}>
                                    <Trash className="h-5 w-5" />
                                </Button>
                            </div>

                            {/* --- SMART ROUTING DISPLAY --- */}
                            <div className="flex flex-col md:flex-row gap-4 pt-4 border-t border-dashed border-muted items-center">
                                <div className="flex-1 w-full">
                                    <div className="flex items-center gap-2 mb-1.5 ml-1">
                                         <Truck className="h-3 w-3 text-indigo-500" />
                                         <p className="text-[9px] font-black uppercase text-indigo-600 tracking-widest">Маршрутизация к Контрагенту</p>
                                    </div>
                                    <FormField
                                        control={form.control}
                                        name={`items.${index}.contractorId`}
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormControl>
                                                    <Select onValueChange={(v) => {
                                                        field.onChange(v);
                                                        const specificLink = (allLogistics || []).find(l => l.contractorId === v && l.linkedPosterId === selectedItemId);
                                                        if (specificLink) form.setValue(`items.${index}.pricePerUnit`, String(specificLink.price));
                                                    }} value={field.value}>
                                                        <SelectTrigger className={cn(
                                                            "h-10 rounded-xl border-none shadow-sm font-bold text-[11px]",
                                                            !field.value ? "bg-rose-50 text-rose-500" : "bg-indigo-50 text-indigo-600"
                                                        )}>
                                                            <SelectValue placeholder="СНАЧАЛА ВЫБЕРИТЕ ТОВАР" />
                                                        </SelectTrigger>
                                                        <SelectContent className="rounded-xl">
                                                            {contractorsForThisItem.map(c => (
                                                                <SelectItem key={c.id} value={c.id} className="rounded-lg">{c.name}</SelectItem>
                                                            ))}
                                                            {contractorsForThisItem.length === 0 && selectedItemId && (
                                                                <div className="p-2 text-[10px] text-rose-500 font-bold flex items-center gap-2">
                                                                    <AlertTriangle className="h-3 w-3" /> Нет привязанных партнеров!
                                                                </div>
                                                            )}
                                                        </SelectContent>
                                                    </Select>
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />
                                </div>
                                <div className="w-full md:w-32">
                                    <p className="text-[9px] font-black uppercase text-muted-foreground mb-1 ml-1">Цена по прайсу</p>
                                    <FormField
                                        control={form.control}
                                        name={`items.${index}.pricePerUnit`}
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormControl><Input {...field} readOnly className="h-10 rounded-xl border-none bg-muted/30 font-black text-xs text-primary" /></FormControl>
                                            </FormItem>
                                        )}
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )
            })}
        </div>
        
        <Button type="submit" className="w-full h-16 rounded-[2rem] bg-indigo-600 hover:bg-black font-black uppercase text-xs tracking-[0.3em] shadow-2xl transition-all active:scale-95 group" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? <RefreshCw className="animate-spin h-5 w-5" /> : (
              <span className="flex items-center gap-3">
                  <LayoutGrid className="h-5 w-5 group-hover:rotate-6 transition-transform" /> 
                  Сформировать умную заявку
              </span>
          )}
        </Button>
      </form>
    </Form>
  );
}
