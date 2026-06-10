'use client';

import React, { useState, useMemo } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormField } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { 
    ShoppingBag, 
    RefreshCw, 
    Zap,
    Search,
    X,
    ClipboardList
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useUser, useCollection, useFirestore } from '@/firebase/hooks';
import { useMemoFirebase, useFirebase } from '@/firebase/provider';
import { collection, query, orderBy, addDoc, serverTimestamp, getDoc, doc } from 'firebase/firestore';
import { ERPItem, SupplierItem, Supplier, OrderStatus, UserRole } from '@/lib/types/erp';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { createOrderAction } from '@/app/orders/actions';

const orderFormSchema = z.object({
  locationId: z.string().min(1, 'Выберите локацию'),
  items: z.array(z.object({
    itemId: z.string().min(1),
    name: z.string(),
    unit: z.string(),
    count: z.string(),
    pricePerUnit: z.string(),
    comment: z.string().optional(),
    isSkipped: z.boolean().optional(),
  })).min(0),
});

type OrderFormValues = z.infer<typeof orderFormSchema>;

export function CreateStaffOrderForm({ 
    allSuppliers, 
    allSupplierItems,
    allLocations 
}: { 
    allSuppliers: Supplier[], 
    allSupplierItems: SupplierItem[],
    allLocations: any[]
}) {
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useUser();
  const { orgId } = useFirebase();
  const firestore = useFirestore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAllItems, setShowAllItems] = useState(false);

  const erpQuery = useMemoFirebase(() => {
    if (!firestore || !orgId) return null;
    return query(collection(firestore, 'organizations', orgId, 'erp_items'), orderBy('name', 'asc'));
  }, [firestore, orgId]);
  const { data: erpItems } = useCollection<ERPItem>(erpQuery);
  const { data: categoriesData } = useCollection<any>(useMemoFirebase(() => (firestore && orgId) ? query(collection(firestore, 'organizations', orgId, 'categories'), orderBy('order', 'asc')) : null, [firestore, orgId]));

  const form = useForm<OrderFormValues>({ resolver: zodResolver(orderFormSchema), defaultValues: { locationId: '1', items: [] } });
  const { fields, append, remove, update } = useFieldArray({ control: form.control, name: 'items' });
  const watchedItems = form.watch('items');

  const todayDay = new Date().getDay();
  const baseDate = new Date(2024, 0, 1);
  const weekIndex = Math.floor(((new Date()).getTime() - baseDate.getTime()) / (1000 * 60 * 60 * 24 * 7));

  const categorizedChecklist = useMemo(() => {
    if (!erpItems || !categoriesData) return [];
    const filtered = erpItems.filter(erp => {
        const matchesSearch = erp.name.toLowerCase().includes(searchTerm.toLowerCase());
        if (!matchesSearch) return false;
        if (showAllItems) return true;
        const schedule = erp.orderSchedule;
        return (schedule?.daysOfWeek?.includes(todayDay)) && (weekIndex % (schedule.weeksInterval || 1) === 0);
    });
    const groups: Record<string, any[]> = {};
    filtered.forEach(erp => {
        const catId = String(erp.categoryId || 'none');
        const sItem = allSupplierItems.find(si => si.linkedPosterId === erp.posterId || si.linkedPosterId === erp.id);
        const itemInfo = { id: erp.id, name: erp.supplierItemName || erp.name, posterName: erp.name, unit: erp.baseUnit, price: sItem?.price || erp.lastPurchasePrice || 0, abcGroup: (erp.abcGroup || 'C').toUpperCase() };
        if (!groups[catId]) groups[catId] = [];
        groups[catId].push(itemInfo);
    });
    const results = categoriesData.map(cat => groups[String(cat.id)] ? { id: String(cat.id), name: cat.name, items: groups[String(cat.id)].sort((a, b) => a.abcGroup.localeCompare(b.abcGroup)) } : null).filter(Boolean);
    if (groups['none']) results.push({ id: 'none', name: 'Прочее', items: groups['none'].sort((a, b) => a.abcGroup.localeCompare(b.abcGroup)) });
    return results as any[];
  }, [erpItems, searchTerm, showAllItems, todayDay, weekIndex, allSupplierItems, categoriesData]);

  async function onSubmit(data: OrderFormValues) {
    if (!user || !firestore) return;
    
    const activeItems = data.items.filter(item => {
        const val = parseFloat(item.count || '0');
        return val > 0 || item.isSkipped;
    });

    if (activeItems.length === 0) {
        toast({ title: 'Пустая заявка', description: 'Введите количество хотя бы для одного товара.', variant: 'destructive' });
        return;
    }

    setIsSubmitting(true);
    try {
        // CLIENT-SIDE ROLE VERIFICATION (Fixes server credential issue)
        const userDoc = await getDoc(doc(firestore, 'users', user.uid));
        const dbRole = userDoc.exists() ? (userDoc.data().role as string).toLowerCase() : 'employee';
        const userRole = (dbRole === 'staff_point' || dbRole === 'kitchen') ? 'employee' : dbRole as UserRole;
        
        const allowedRoles: UserRole[] = ['super_admin', 'brand_admin', 'outlet_admin', 'employee', 'cashier'];
        if (!allowedRoles.includes(userRole)) {
            throw new Error(`Ваша роль (${userRole}) не позволяет создавать заявки.`);
        }

        // CONSOLIDATION LOGIC: Save to Firestore directly from CLIENT to avoid Admin SDK errors
        const itemsToSubmit = activeItems.map(it => {
            const erp = erpItems?.find(e => e.id === it.itemId);
            const countVal = parseFloat(it.count || '0');
            return {
                itemId: it.itemId,
                posterId: erp?.posterId || '',
                name: it.name,
                unit: it.unit,
                count: countVal,
                pricePerUnit: parseFloat(it.pricePerUnit) || 0,
                totalPrice: countVal * (parseFloat(it.pricePerUnit) || 0),
                isSkipped: !!it.isSkipped,
                comment: it.comment || ''
            };
        });

        const newOrder: any = {
            orgId,
            supplierId: 'PENDING',
            supplierName: 'На проверке (Поставщик не выбран)',
            locationId: data.locationId,
            locationName: allLocations.find(l => l.id === data.locationId)?.name || 'Общая локация',
            orderType: 'PLANNED',
            limitType: 'MAX',
            createdBy: user.uid,
            status: 'NEED_REVIEW',
            items: itemsToSubmit,
            hasCriticalDiscrepancy: false,
            isConfirmedByAdmin: false,
        };

        const result = await createOrderAction(newOrder);

        if (result.success) {
            toast({ title: 'Заявка сохранена!', description: 'Доступна в разделе «Заявки FLOW» и отправлена в Telegram.' });
            router.push('/orders');
        } else {
            toast({ title: 'Ошибка при сохранении', description: result.error, variant: 'destructive' });
        }
    } catch (e: any) { 
        toast({ title: 'Ошибка сохранения', description: e.message, variant: 'destructive' }); 
    } finally { 
        setIsSubmitting(false); 
    }
  }

  const itemsToSubmit = watchedItems.filter(f => parseFloat(f.count || '0') > 0 || f.isSkipped);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pb-40 px-2 sm:px-4">
        {/* HEADER */}
        <div className="sticky top-0 z-[60] py-2 px-3 bg-background/80 backdrop-blur-xl border-b flex items-center justify-between gap-3 -mt-4 mx-[-1rem]">
            <div className="flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-primary" />
                <h2 className="font-black uppercase text-[10px] tracking-tight">Потребности</h2>
                <Badge variant="secondary" className="text-[8px] h-4 font-black px-1.5">{allLocations.find(l => l.id === form.getValues().locationId)?.name}</Badge>
            </div>
            <div className="flex-1 max-w-[200px] relative flex items-center gap-1.5">
                <div className="relative flex-1">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input placeholder="Поиск..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-7 h-8 text-[10px] rounded-lg bg-muted/60 border-none shadow-sm" />
                </div>
                <Button type="button" variant={showAllItems ? "default" : "outline"} size="sm" onClick={() => setShowAllItems(!showAllItems)} className="h-8 px-2 rounded-lg text-[8px] font-black uppercase">{showAllItems ? 'Прайс' : 'План'}</Button>
            </div>
        </div>

        {/* LIST */}
        <div className="space-y-8">
            {categorizedChecklist.map(category => (
                <div key={category.id} className="space-y-2">
                    <h4 className="font-black uppercase text-[9px] tracking-widest text-muted-foreground flex items-center gap-2 ml-1">
                        <div className="h-1 w-1 rounded-full bg-primary" /> {category.name} ({category.items.length})
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-1.5">
                        {category.items.map((si: any) => {
                            const existingIdx = fields.findIndex(f => f.itemId === si.id);
                            const fieldData = existingIdx !== -1 ? watchedItems[existingIdx] : null;
                            const isSkipped = fieldData?.isSkipped;
                            const currentVal = fieldData?.count || '';
                            
                            return (
                                <Card key={si.id} className={cn(
                                    "rounded-xl border border-border/40 shadow-sm transition-all overflow-hidden bg-card h-[84px] group",
                                    currentVal && !isSkipped && "ring-2 ring-primary bg-primary/5",
                                    isSkipped && "opacity-40 grayscale",
                                    si.abcGroup === 'A' ? "border-l-4 border-l-rose-500" : si.abcGroup === 'B' ? "border-l-4 border-l-indigo-500" : "border-l-4 border-l-slate-400"
                                )}>
                                    <div className="p-2 h-full flex flex-col justify-between">
                                        <div className="flex flex-col gap-0.5 min-w-0">
                                            <div className="text-[10px] font-black truncate leading-none uppercase text-accent-foreground">{si.name}</div>
                                            <div className="flex items-center justify-between mt-0.5">
                                                <span className="text-[8px] font-bold text-muted-foreground/60 uppercase">{si.unit}</span>
                                                <span className="text-[8px] font-black text-muted-foreground/40">{si.abcGroup}</span>
                                            </div>
                                        </div>
                                        <div className="relative mt-auto">
                                            <Input type="number" placeholder="0" disabled={isSkipped} value={currentVal}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    if (existingIdx === -1) append({ itemId: si.id, name: si.name, unit: si.unit || 'kg', pricePerUnit: String(si.price || 0), count: val, isSkipped: false });
                                                    else update(existingIdx, { ...watchedItems[existingIdx], count: val, isSkipped: false });
                                                }}
                                                className="h-7 pr-7 rounded-lg bg-muted/40 border-none font-black text-[10px] text-center focus:bg-background h-7 px-1"
                                            />
                                            <div className="absolute right-0 top-1/2 -translate-y-1/2 flex">
                                                {currentVal ? (
                                                    <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-rose-500 hover:bg-rose-50" onClick={() => remove(existingIdx)}><X className="h-3 w-3" /></Button>
                                                ) : (
                                                    <Button type="button" variant="ghost" className="h-6 px-1.5 text-[7px] font-black uppercase text-slate-400"
                                                        onClick={() => {
                                                            if (existingIdx === -1) append({ itemId: si.id, name: si.name, unit: si.unit || 'kg', pricePerUnit: String(si.price || 0), count: '0', isSkipped: true });
                                                            else update(existingIdx, { ...watchedItems[existingIdx], count: '0', isSkipped: true });
                                                        }}
                                                    >{isSkipped ? 'Вкл' : 'Проп'}</Button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </Card>
                            );
                        })}
                    </div>
                </div>
            ))}
        </div>

        {/* SUBMIT BUTTON */}
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-[300px] px-4 pointer-events-none">
            <Button 
                type="submit" 
                disabled={isSubmitting || itemsToSubmit.length === 0}
                className="w-full h-12 rounded-full font-black uppercase tracking-widest text-[10px] shadow-2xl pointer-events-auto flex items-center justify-center gap-2 bg-primary text-white enabled:hover:scale-105 active:scale-95 transition-all"
            >
                {isSubmitting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4 fill-current" />}
                ОТПРАВИТЬ ПОТРЕБНОСТЬ ({itemsToSubmit.length})
            </Button>
        </div>
      </form>
    </Form>
  );
}
