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
import { Trash, PlusCircle, AlertTriangle, CheckCircle2, ImagePlus, Loader2, Sparkles } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useMemo, useState, useRef } from 'react';
import { useUser, useFirestore } from '@/firebase/hooks';
import { useFirebase } from '@/firebase/provider';
import { collection, doc, serverTimestamp, writeBatch, increment } from 'firebase/firestore';
import { SearchableSelect } from '../ui/searchable-select';
import { formatNumberString, parseFormattedNumber, translateUnit } from '@/lib/utils';
import { type Storage } from '@/lib/poster';
import { processSupplyAction } from '@/app/actions/flow-core';
import { ERPItem, Supplier } from '@/lib/types/erp';
import { cn } from '@/lib/utils';
import { runReceiptOCRAction } from '@/app/actions/ai-ocr-actions';
import { getSmartIngredientMatchesAction, saveIngredientMappingAction } from '@/app/actions/ai-matching-actions';

const formSchema = z.object({
  supplier_id: z.string().min(1, 'Нужно выбрать поставщика'),
  storage_id: z.string().min(1, 'Нужно выбрать склад'),
  comment: z.string().optional(),
  ingredients: z.array(z.object({
    item_id: z.string().min(1, 'Нужно выбрать товар'),
    count: z.string().min(1, 'Введите кол-во').refine(val => parseFormattedNumber(val) > 0, { message: 'Кол-во > 0'}),
    price: z.string().min(1, 'Введите сумму').refine(val => parseFormattedNumber(val) >= 0, { message: 'Сумма >= 0'}),
    scannedName: z.string().optional(), // Добавляем поле для хранения оригинального имени из чека
  })).min(1, 'Нужно добавить хотя бы одну позицию'),
});

type CreateSupplyFormValues = z.infer<typeof formSchema>;

export function CreateSupplyForm({ 
  storages, 
  ingredients, 
  suppliers, 
  onFormSubmitted 
}: { 
  storages: Storage[]; 
  ingredients: ERPItem[] | null; 
  suppliers: Supplier[] | null; 
  onFormSubmitted: () => void;
}) {
  const { toast } = useToast();
  const { user } = useUser();
  const { orgId } = useFirebase();
  const firestore = useFirestore();
  const erpItems = ingredients;
  const [isScanning, setIsScanning] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<CreateSupplyFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      supplier_id: '',
      storage_id: '',
      comment: '',
      ingredients: [{ item_id: '', count: '', price: '', scannedName: '' }],
    },
  });

  const itemOptions = useMemo(() => (erpItems || []).map(item => ({ value: item.id, label: item.name })), [erpItems]);
  const supplierOptions = useMemo(() => (suppliers || []).map(s => ({ value: s.id, label: s.name })), [suppliers]);
  const storageOptions = useMemo(() => (storages || []).map(s => ({ value: String(s.storage_id), label: s.storage_name })), [storages]);

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'ingredients',
  });

  const watchedIngredients = form.watch('ingredients');

  async function onSubmit(values: CreateSupplyFormValues) {
    if (!user || !firestore || !orgId) return;
    
    // 1. Prepare Base Supply Info
    const selectedSupplier = suppliers?.find(s => s.id === values.supplier_id);
    const realSupplierName = selectedSupplier?.name || "Неизвестен";
    const dateForApi = new Date().toISOString().replace('T', ' ').slice(0, 19);

    // 2. Logic from Google Apps Script: "Try Ingredient, then try Product if it fails"
    // We will build the payload following the EXACT structure of your working script
    const supplyBase = {
        date: dateForApi,
        supplier_id: "1", // Hardcoded per your script
        storage_id: String(values.storage_id),
        supply_comment: `[FLOW] ${realSupplierName}: ${values.comment || ''}`
    };

    // 3. For each item, decide if it's type 4 (Ingredient) or 1 (Product) using your Script's logic
    const payloadIngredients: any[] = [];
    const payloadProducts: any[] = [];

    values.ingredients.forEach(ing => {
        const item = erpItems?.find(i => i.id === ing.item_id);
        if (!item) return;
        
        const count = parseFormattedNumber(ing.count);
        const totalPrice = parseFormattedNumber(ing.price);
        const pricePerUnit = count > 0 ? (totalPrice / count).toFixed(2) : "0";

        // Logic from your script: if it's a product with type 3 in Poster, use products array
        // In our ERP, we track this in item.type.
        if (item.type === 'SEMI_FINISHED' || item.type === 'PRODUCT') {
            payloadProducts.push({
                product_id: String(item.posterId),
                num: String(count),
                type: "1", // Poster Product Type 1
                price: pricePerUnit
            });
        } else {
            payloadIngredients.push({
                id: String(item.posterId),
                num: String(count),
                type: "4", // Poster Ingredient Type 4
                price: pricePerUnit
            });
        }
    });

    const finalPayload = {
        supply: supplyBase,
        ingredient: payloadIngredients.length > 0 ? payloadIngredients : undefined,
        products: payloadProducts.length > 0 ? payloadProducts : undefined
    };

    try {
        const result = await processSupplyAction(finalPayload as any, user.uid, orgId);
        if (result.success) {
            const batch = writeBatch(firestore);
            let totalAmount = 0;

            values.ingredients.forEach(ing => {
                const item = erpItems?.find(i => i.id === ing.item_id);
                if (!item) return;

                const count = parseFormattedNumber(ing.count);
                const price = parseFormattedNumber(ing.price);
                totalAmount += price;

                const tRef = doc(collection(firestore, 'organizations', orgId, 'stock_transactions'));
                batch.set(tRef, {
                    id: tRef.id,
                    type: 'PURCHASE',
                    itemId: item.id,
                    locationId: values.storage_id,
                    quantity: count,
                    userId: user.uid,
                    referenceId: result.posterSupplyId,
                    timestamp: serverTimestamp(),
                    comment: values.comment
                });

                batch.update(doc(firestore, 'organizations', orgId, 'erp_items', item.id), {
                    lastPurchasePrice: count > 0 ? price / count : 0
                });
            });

            batch.update(doc(firestore, 'organizations', orgId, 'suppliers', values.supplier_id), {
                balance: increment(totalAmount)
            });

            // 4. ОБУЧЕНИЕ: Сохраняем маппинги для ИИ на будущее
            values.ingredients.forEach(ing => {
                if (ing.scannedName && ing.item_id) {
                    saveIngredientMappingAction(orgId, {
                        contractorId: values.supplier_id,
                        linkedErpItemId: ing.item_id,
                        supplierName: ing.scannedName,
                        unit: 'кг' // По умолчанию
                    });
                }
            });

            await batch.commit();
            toast({ title: 'Готово!', description: `Поставка создана (ID: ${result.posterSupplyId})` });
            onFormSubmitted();
            form.reset();
        } else {
            toast({ variant: 'destructive', title: 'Ошибка Poster', description: result.message });
        }
    } catch (err) {
        toast({ variant: 'destructive', title: 'Ошибка', description: err instanceof Error ? err.message : 'Ошибка API' });
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!orgId) {
      toast({ variant: 'destructive', title: 'Ошибка', description: 'Организация не определена' });
      return;
    }

    setIsScanning(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(',')[1];
        
        // 1. OCR Extract
        const result = await runReceiptOCRAction(base64, file.type, orgId);
        if (!result || !result.items || result.items.length === 0) {
          toast({ variant: 'destructive', title: 'Не удалось найти товары', description: 'Попробуйте другое фото' });
          return;
        }

        // 2. AI Matching
        const matches = await getSmartIngredientMatchesAction(orgId, result.items, form.getValues('supplier_id'));
        
        // 3. Populate Form
        const newIngredients = matches.map(m => {
          const scannedItem = result.items?.find(si => si.name === m.scannedName);
          return {
            item_id: m.matchedItemId || '',
            count: scannedItem?.qty ? String(scannedItem.qty) : '1',
            price: scannedItem?.sum ? String(scannedItem.sum) : '0',
            scannedName: m.scannedName // Сохраняем для обучения
          };
        });

        // Replace or append? User probably wants to replace if they start with scan
        if (form.getValues('ingredients').length === 1 && !form.getValues('ingredients')[0].item_id) {
            form.setValue('ingredients', newIngredients);
        } else {
            // Append
            const current = form.getValues('ingredients');
            form.setValue('ingredients', [...current, ...newIngredients]);
        }

        toast({ 
            title: 'Инвойс обработан!', 
            description: `Найдено позиций: ${newIngredients.length}` 
        });
      };
      reader.readAsDataURL(file);
    } catch (err) {
      toast({ variant: 'destructive', title: 'Ошибка ИИ', description: String(err) });
    } finally {
      setIsScanning(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <Form {...form}>
      <div className="flex justify-between items-center mb-4 p-4 bg-blue-50/50 rounded-2xl border border-blue-100">
        <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-blue-600" />
            <span className="text-sm font-bold text-blue-900">Умный импорт из накладной</span>
        </div>
        <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept="image/*" 
            onChange={handleFileChange} 
        />
        <Button 
            type="button" 
            variant="outline" 
            size="sm" 
            className="rounded-xl border-blue-200 bg-white hover:bg-blue-50 text-blue-700 font-bold"
            disabled={isScanning}
            onClick={() => fileInputRef.current?.click()}
        >
            {isScanning ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Обработка...</>
            ) : (
                <><ImagePlus className="mr-2 h-4 w-4" /> Сканировать Чек</>
            )}
        </Button>
      </div>

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
                const lastPrice = erpItem?.lastPurchasePrice || 0;
                
                return (
                    <div key={field.id} className="grid grid-cols-[1fr_auto_auto_auto] items-start gap-2 p-2 border rounded-md bg-white">
                        <FormField
                          control={form.control}
                          name={`ingredients.${index}.item_id`}
                          render={({ field }) => (
                            <FormItem className="flex-1">
                              <FormControl>
                                <SearchableSelect options={itemOptions} value={field.value} onChange={field.onChange} placeholder="Товар" />
                              </FormControl>
                              <div className="flex flex-col gap-1 mt-1">
                                {watchedIngredients[index]?.scannedName && (
                                    <div className="text-[10px] flex items-center gap-1 text-blue-500 font-bold bg-blue-50 px-2 py-0.5 rounded-full w-fit">
                                        <Sparkles className="w-3 h-3" />
                                        Из чека: {watchedIngredients[index].scannedName}
                                    </div>
                                )}
                                {erpItem && lastPrice > 0 && (
                                    <div className="text-[10px] text-muted-foreground ml-1">
                                        Пред. цена: {lastPrice.toLocaleString()} сум
                                    </div>
                                )}
                              </div>
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
                                            className="w-28 text-right font-medium"
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
              <FormLabel>Комментарий (Audit)</FormLabel>
              <FormControl><Textarea placeholder="Детали..." {...field} /></FormControl>
            </FormItem>
          )}
        />
        
        <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? 'Синхронизация...' : 'Провести поставку'}
        </Button>
      </form>
    </Form>
  );
}
