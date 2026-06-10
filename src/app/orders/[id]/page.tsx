'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useDoc, useFirestore, useUser, useCollection } from '@/firebase/hooks';
import { useMemoFirebase, useFirebase } from '@/firebase/provider';

import { doc, collection, query, orderBy, getDoc, writeBatch, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { OrderRequest, OrderItem, Contractor, ERPItem, OrderStatus } from '@/lib/types/erp';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Badge } from '@/components/ui/badge';
import { 
  ArrowLeft, Trash2, PlusCircle, CheckCircle, ChevronRight, 
  Sparkles, FileText, Landmark, RefreshCw, X, Eye, ZoomIn
} from 'lucide-react';
import { processSupplyAction } from '@/app/actions/flow-core';
import { saveIngredientMappingAction } from '@/app/actions/ai-matching-actions';
import { finalizeOrderAction, payAccountsPayableAction } from '@/app/orders/actions';

export default function OrderDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const firestore = useFirestore();
  const { user } = useUser();
  const { orgId } = useFirebase();
  const { toast } = useToast();
  const orderId = params.id as string;

  const [items, setItems] = useState<any[]>([]);

  const [supplierId, setSupplierId] = useState<string>('');
  const [locationId, setLocationId] = useState<string>('1');
  const [comment, setComment] = useState<string>('');
  const [isPending, setIsPending] = useState(false);
  const [showFullImage, setShowFullImage] = useState(false);

  const orderRef = useMemoFirebase(() => 
    (firestore && orderId && orgId) ? doc(firestore, 'organizations', orgId, 'order_requests', orderId) : null,
    [firestore, orderId, orgId]
  );

  const { data: order, isLoading: isOrderLoading } = useDoc<OrderRequest>(orderRef);

  const suppliersQuery = useMemoFirebase(() => {
    if (!firestore || !orgId) return null;
    return query(collection(firestore, 'organizations', orgId, 'suppliers'), orderBy('name', 'asc'));
  }, [firestore, orgId]);
  const { data: suppliers } = useCollection<Contractor>(suppliersQuery);

  const erpItemsQuery = useMemoFirebase(() => {
    if (!firestore || !orgId) return null;
    return query(collection(firestore, 'organizations', orgId, 'erp_items'), orderBy('name', 'asc'));
  }, [firestore, orgId]);
  const { data: erpItems } = useCollection<ERPItem>(erpItemsQuery);

  const erpOptions = useMemo(() => 
    (erpItems || []).map(item => ({ value: item.id, label: item.name })), 
    [erpItems]
  );

  const supplierOptions = useMemo(() => 
    (suppliers || []).map(s => ({ value: s.id, label: s.name })), 
    [suppliers]
  );

  const locationOptions = [
    { value: '1', label: 'Основной Склад' },
    { value: '2', label: 'Кухня (Master)' },
    { value: '3', label: 'Бар (Point)' },
  ];

  useEffect(() => {
    if (order) {
      setItems(order.items || []);
      setSupplierId(order.supplierId || '');
      setLocationId(order.locationId || '1');
      setComment(order.comment || '');
    }
  }, [order]);

  const handleItemChange = (index: number, field: string, value: any) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    
    // If we changed the erp item, update unit and posterId automatically
    if (field === 'itemId') {
      const selected = erpItems?.find(e => e.id === value);
      if (selected) {
        updated[index].unit = selected.baseUnit || 'кг';
        updated[index].posterId = selected.posterId || '';
      }
    }
    setItems(updated);
  };

  const handleAddItem = () => {
    setItems([...items, { itemId: '', name: '', count: 1, pricePerUnit: 0, invoiceWeight: 1, finalWeight: 1 }]);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleDeleteDraft = async () => {
    if (!firestore || !orderId || !orgId) return;
    if (!window.confirm('Вы действительно хотите удалить этот черновик поставки?')) return;
    
    setIsPending(true);
    try {
      await deleteDoc(doc(firestore, 'organizations', orgId, 'order_requests', orderId));

      toast({ title: 'Черновик удален' });
      router.push('/orders');
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Ошибка удаления', description: e.message });
    } finally {
      setIsPending(false);
    }
  };

  const handleConfirmAndPost = async () => {
    if (!user || !firestore || !order) return;
    if (!supplierId) {
      toast({ variant: 'destructive', title: 'Ошибка', description: 'Пожалуйста, выберите поставщика.' });
      return;
    }
    if (items.length === 0) {
      toast({ variant: 'destructive', title: 'Ошибка', description: 'Добавьте хотя бы одну позицию.' });
      return;
    }

    setIsPending(true);
    try {
      const selectedSupplier = suppliers?.find(s => s.id === supplierId);
      const supplierName = selectedSupplier?.name || 'Неизвестный поставщик';
      const dateForApi = new Date().toISOString().replace('T', ' ').slice(0, 19);

      // 1. Construct Poster Payload
      const supplyBase = {
        date: dateForApi,
        supplier_id: "1", // Hardcoded per Apps Script setup
        storage_id: String(locationId),
        supply_comment: `[FLOW] ${supplierName}: Накладная №${order.id.slice(-6).toUpperCase()}. ${comment}`
      };

      const payloadIngredients: any[] = [];
      const payloadProducts: any[] = [];

      items.forEach(ing => {
        const item = erpItems?.find(i => i.id === ing.itemId);
        if (!item) return;
        
        const count = ing.finalWeight ?? ing.invoiceWeight ?? ing.count ?? 0;
        const pricePerUnit = ing.pricePerUnit || 0;

        if (item.type === 'SEMI_FINISHED' || item.type === 'PRODUCT') {
          payloadProducts.push({
            product_id: String(item.posterId),
            num: String(count),
            type: "1",
            price: String(pricePerUnit)
          });
        } else {
          payloadIngredients.push({
            id: String(item.posterId),
            num: String(count),
            type: "4",
            price: String(pricePerUnit)
          });
        }
      });

      const finalPayload = {
        supply: supplyBase,
        ingredient: payloadIngredients.length > 0 ? payloadIngredients : undefined,
        products: payloadProducts.length > 0 ? payloadProducts : undefined
      };

      // 2. Submit to Poster API
      const posterResult = await processSupplyAction(finalPayload as any, user.uid);
      if (!posterResult.success) {
        throw new Error(posterResult.message || 'Ошибка создания поставки в API Poster.');
      }

      const posterSupplyId = posterResult.posterSupplyId!;

      // 3. Batch Writes for Stock transactions, Prices and Contractor mapping
      const batch = writeBatch(firestore);
      let calculatedTotalSum = 0;

      items.forEach(ing => {
        const item = erpItems?.find(i => i.id === ing.itemId);
        if (!item) return;

        const count = ing.finalWeight ?? ing.invoiceWeight ?? ing.count ?? 0;
        const pricePerUnit = ing.pricePerUnit || 0;
        const itemTotalSum = count * pricePerUnit;
        calculatedTotalSum += itemTotalSum;

        // Stock transaction record
        const tRef = doc(collection(firestore, 'organizations', orgId!, 'stock_transactions'));
        batch.set(tRef, {
          id: tRef.id,
          type: 'PURCHASE',
          itemId: item.id,
          locationId: locationId,
          quantity: count,
          userId: user.uid,
          referenceId: posterSupplyId,
          timestamp: serverTimestamp(),
          comment: comment || 'Приемка по фото'
        });

        // Update last purchase price
        batch.update(doc(firestore, 'organizations', orgId!, 'erp_items', item.id), {
          lastPurchasePrice: pricePerUnit
        });
      });

      // Save updated order details locally in transaction
      batch.update(orderRef!, {
        supplierId,
        supplierName,
        locationId,
        locationName: locationOptions.find(l => l.value === locationId)?.label || 'Основной Склад',
        comment,
        items,
        totalPrice: calculatedTotalSum,
        updatedAt: serverTimestamp()
      });

      await batch.commit();

      // 4. Save mapping for AI OCR learning
      items.forEach(ing => {
        if (ing.name && ing.itemId && orgId) {
          saveIngredientMappingAction(orgId, {
            contractorId: supplierId,
            linkedErpItemId: ing.itemId,
            supplierName: ing.name,
            unit: ing.unit || 'кг'
          });
        }
      });

      // 5. Finalize order (creates accounts_payable invoice & updates supplier balance)
      const finalizeResult = await finalizeOrderAction(orgId!, orderId, posterSupplyId, calculatedTotalSum, user.uid);

      if (!finalizeResult.success) {
        throw new Error(finalizeResult.error || 'Ошибка проведения расчетов кредиторской задолженности.');
      }

      toast({ title: 'Поставка успешно проведена!', description: `Создана накладная в Poster ID: ${posterSupplyId}` });
      router.push('/payable');

    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Ошибка проведения', description: e.message });
    } finally {
      setIsPending(false);
    }
  };

  const handlePayAndArchive = async () => {
    if (!orgId || !orderId || !user) return;
    setIsPending(true);
    try {
      const res = await payAccountsPayableAction(
        orgId,
        orderId,
        user.uid,
        user.displayName || user.email || 'Сотрудник'
      );
      if (!res.success) {
        throw new Error(res.error || 'Не удалось провести оплату');
      }
      toast({ title: 'Оплачено', description: 'Счет закрыт, транзакция списания создана, долг уменьшен.' });
      router.push('/payable');
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Ошибка', description: e.message });
    } finally {
      setIsPending(false);
    }
  };

  if (isOrderLoading) {
    return <div className="p-12 text-center animate-pulse text-slate-400 font-bold uppercase tracking-widest">Загрузка данных...</div>;
  }

  if (!order) {
    return <div className="p-12 text-center text-rose-500 font-bold uppercase tracking-widest">Накладная не найдена</div>;
  }

  const isCompleted = order.status === 'POSTED_TO_POSTER' || order.status === 'ARCHIVED';
  const totalInvoiceSum = items.reduce((acc, item) => acc + ((item.finalWeight ?? item.count) * (item.pricePerUnit || 0)), 0);

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-24 mt-8 px-4 md:px-0">
      
      {/* Detail header */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => router.back()} className="rounded-xl flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" />
          <span>Назад</span>
        </Button>
        <div className="flex gap-2">
          {isCompleted && order.status !== 'ARCHIVED' && (
            <Button 
              onClick={handlePayAndArchive} 
              disabled={isPending}
              className="bg-emerald-600 hover:bg-emerald-700 font-bold text-xs uppercase tracking-wider rounded-xl text-white border-none flex items-center gap-1.5"
            >
              <Landmark className="w-4 h-4" /> Оплатить и архивировать
            </Button>
          )}
          {!isCompleted && (
            <Button 
              variant="outline" 
              onClick={handleDeleteDraft} 
              disabled={isPending}
              className="border-rose-200 hover:bg-rose-50 text-rose-600 font-bold text-xs uppercase tracking-wider rounded-xl"
            >
              <Trash2 className="w-4 h-4 mr-1.5" /> Удалить черновик
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Column: Image viewer */}
        <div className="lg:col-span-5 space-y-4">
          <Card className="rounded-[2rem] border-none shadow-md overflow-hidden bg-white">
            <CardHeader className="pb-4">
              <CardTitle className="text-sm font-black uppercase text-slate-400 tracking-wider flex items-center justify-between">
                <span>Фотография накладной</span>
                {order.imageUrl && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setShowFullImage(true)} 
                    className="h-8 text-blue-500 hover:text-blue-700 font-bold text-[10px] uppercase tracking-wider"
                  >
                    <ZoomIn className="w-3.5 h-3.5 mr-1" /> Увеличить
                  </Button>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {order.imageUrl ? (
                <div className="relative h-[480px] bg-slate-100 flex items-center justify-center cursor-pointer" onClick={() => setShowFullImage(true)}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img 
                    src={order.imageUrl} 
                    alt="Накладная" 
                    className="object-contain w-full h-full max-h-[480px] hover:scale-[1.02] transition-transform duration-300"
                  />
                  <div className="absolute bottom-4 right-4 bg-black/60 text-white rounded-md text-[10px] font-bold px-3 py-1 uppercase tracking-wider backdrop-blur-sm flex items-center gap-1.5">
                    <Sparkles className="w-3 h-3 text-blue-300" /> Кликните для полного экрана
                  </div>
                </div>
              ) : (
                <div className="h-64 flex flex-col items-center justify-center text-slate-400 bg-slate-50 border-t border-b text-xs py-12">
                  <FileText className="w-12 h-12 mb-3 text-slate-300" />
                  <span>Фотография накладной отсутствует</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Editing Form */}
        <div className="lg:col-span-7 space-y-6">
          <Card className="rounded-[2rem] border-none shadow-md overflow-hidden bg-white">
            <div className="h-2 bg-slate-900 w-full" />
            <CardHeader className="p-8 pb-4">
              <div className="flex justify-between items-start border-b border-slate-100 pb-4">
                <div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Сводный лист приемки
                  </span>
                  <h1 className="text-xl font-black uppercase tracking-tight text-slate-900 mt-1">
                    Накладная № {order.id.slice(-6).toUpperCase()}
                  </h1>
                </div>
                <Badge className={isCompleted ? "bg-emerald-100 text-emerald-800 border-none font-bold text-[10px] uppercase rounded-lg" : "bg-blue-100 text-blue-800 border-none font-bold text-[10px] uppercase rounded-lg"}>
                  {order.status === 'POSTED_TO_POSTER' ? 'Проведено в Poster' : order.status === 'ARCHIVED' ? 'Архивировано' : 'Сверка и Взвешивание'}
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="p-8 pt-2 space-y-6">
              {/* Supplier & Storage Selection */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider pl-1">
                    Поставщик (ERP)
                  </label>
                  {isCompleted ? (
                    <div className="h-10 bg-slate-50 rounded-xl px-3 border flex items-center text-sm font-bold text-slate-700 uppercase">
                      {order.supplierName}
                    </div>
                  ) : (
                    <SearchableSelect 
                      options={supplierOptions} 
                      value={supplierId} 
                      onChange={setSupplierId} 
                      placeholder="Выберите поставщика" 
                    />
                  )}
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider pl-1">
                    Склад поступления (Poster)
                  </label>
                  {isCompleted ? (
                    <div className="h-10 bg-slate-50 rounded-xl px-3 border flex items-center text-sm font-bold text-slate-700 uppercase">
                      {order.locationName}
                    </div>
                  ) : (
                    <SearchableSelect 
                      options={locationOptions} 
                      value={locationId} 
                      onChange={setLocationId} 
                      placeholder="Выберите склад" 
                    />
                  )}
                </div>
              </div>

              {/* Items editing table */}
              <div className="space-y-3">
                <div className="flex justify-between items-center pl-1">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                    Товары в накладной
                  </span>
                  {!isCompleted && (
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="sm" 
                      onClick={handleAddItem}
                      className="text-blue-600 hover:text-blue-700 font-bold text-xs uppercase tracking-wider flex items-center gap-1"
                    >
                      <PlusCircle className="w-4 h-4" /> Добавить товар
                    </Button>
                  )}
                </div>

                <div className="border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
                  <Table>
                    <TableHeader className="bg-slate-900 border-none">
                      <TableRow className="hover:bg-transparent border-none">
                        <TableHead className="font-black text-white/50 text-[10px] uppercase py-3">Ингредиент ERP</TableHead>
                        <TableHead className="w-24 text-center font-black text-white/50 text-[10px] uppercase">Кол-во</TableHead>
                        <TableHead className="w-28 text-right font-black text-white/50 text-[10px] uppercase">Цена (Сум)</TableHead>
                        <TableHead className="w-28 text-center font-black text-white/50 text-[10px] uppercase text-blue-300">Вес Факт</TableHead>
                        {!isCompleted && <TableHead className="w-10 text-center font-black text-white/50 text-[10px] uppercase"></TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((item, idx) => {
                        const matchedErp = erpItems?.find(e => e.id === item.itemId);
                        const lastPrice = matchedErp?.lastPurchasePrice || 0;

                        return (
                          <TableRow key={idx} className="hover:bg-slate-50/50 border-slate-100 h-16">
                            {/* Item ERP Match */}
                            <TableCell className="py-2">
                              {isCompleted ? (
                                <div className="flex flex-col">
                                  <span className="font-black text-slate-900 text-xs uppercase leading-tight">
                                    {matchedErp?.name || item.name}
                                  </span>
                                  {item.name !== matchedErp?.name && (
                                    <span className="text-[9px] text-slate-400 mt-1 italic">
                                      В чеке: {item.name}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <div className="space-y-1 max-w-[280px]">
                                  <SearchableSelect 
                                    options={erpOptions} 
                                    value={item.itemId} 
                                    onChange={(val) => handleItemChange(idx, 'itemId', val)} 
                                    placeholder="Связать с ингредиентом..." 
                                  />
                                  {item.name && item.name !== matchedErp?.name && (
                                    <div className="text-[9px] text-blue-500 font-bold bg-blue-50 px-2 py-0.5 rounded-md w-fit flex items-center gap-1">
                                      <Sparkles className="w-2.5 h-2.5" /> Скан: {item.name}
                                    </div>
                                  )}
                                  {lastPrice > 0 && (
                                    <span className="text-[9px] text-slate-400 block pl-1">
                                      Пред. цена: {lastPrice.toLocaleString()} сум
                                    </span>
                                  )}
                                </div>
                              )}
                            </TableCell>

                            {/* Quantity */}
                            <TableCell className="text-center">
                              {isCompleted ? (
                                <span className="font-bold text-xs text-slate-600">
                                  {item.count} {item.unit || 'шт'}
                                </span>
                              ) : (
                                <div className="flex items-center justify-center gap-1">
                                  <Input 
                                    type="number" 
                                    value={item.count} 
                                    onChange={(e) => handleItemChange(idx, 'count', parseFloat(e.target.value) || 0)} 
                                    className="w-16 text-center font-bold h-9 rounded-lg"
                                  />
                                  <span className="text-[10px] text-slate-400 font-bold uppercase">{item.unit || 'шт'}</span>
                                </div>
                              )}
                            </TableCell>

                            {/* Unit Price */}
                            <TableCell className="text-right">
                              {isCompleted ? (
                                <span className="font-bold text-xs text-slate-700">
                                  {item.pricePerUnit?.toLocaleString()} UZS
                                </span>
                              ) : (
                                <Input 
                                  type="number" 
                                  value={item.pricePerUnit} 
                                  onChange={(e) => handleItemChange(idx, 'pricePerUnit', parseFloat(e.target.value) || 0)} 
                                  className="w-24 text-right font-medium h-9 rounded-lg"
                                />
                              )}
                            </TableCell>

                            {/* Actual Weight */}
                            <TableCell className="text-center bg-blue-50/10">
                              {isCompleted ? (
                                <span className="font-black text-sm text-blue-600">
                                  {item.finalWeight ?? item.count} {item.unit || 'шт'}
                                </span>
                              ) : (
                                <Input 
                                  type="number" 
                                  value={item.finalWeight ?? item.count} 
                                  placeholder={String(item.count)}
                                  onChange={(e) => handleItemChange(idx, 'finalWeight', parseFloat(e.target.value) || 0)} 
                                  className="w-20 text-center font-black h-9 border-blue-200 focus-visible:ring-blue-300 text-blue-700 bg-blue-50/30 rounded-lg"
                                />
                              )}
                            </TableCell>

                            {/* Trash action */}
                            {!isCompleted && (
                              <TableCell className="text-center">
                                <Button 
                                  type="button" 
                                  variant="ghost" 
                                  size="icon" 
                                  onClick={() => handleRemoveItem(idx)}
                                  className="text-slate-300 hover:text-rose-500 rounded-lg h-9 w-9"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            )}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Comment input */}
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider pl-1">
                  Заметки к поставке (Комментарий)
                </label>
                {isCompleted ? (
                  <p className="bg-slate-50 rounded-xl p-3 border border-slate-100 text-slate-600 text-xs italic">
                    {comment || 'Заметки отсутствуют'}
                  </p>
                ) : (
                  <Textarea 
                    value={comment} 
                    onChange={(e) => setComment(e.target.value)} 
                    placeholder="Например: Помидоры отличные, коробка замята..." 
                    className="rounded-xl min-h-[80px]"
                  />
                )}
              </div>

              {/* Cost summary card */}
              <div className="bg-slate-900 text-white rounded-3xl p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-xl">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/50">Итоговая сумма накладной</p>
                  <p className="text-2xl font-black tracking-tight mt-1 tabular-nums">
                    {totalInvoiceSum.toLocaleString()} <span className="text-sm font-normal text-white/60 uppercase">сум</span>
                  </p>
                </div>
                
                {!isCompleted && (
                  <Button 
                    onClick={handleConfirmAndPost} 
                    disabled={isPending}
                    className="h-12 px-8 bg-blue-600 hover:bg-blue-700 text-white font-black uppercase text-[10px] tracking-widest rounded-xl flex items-center gap-2 border-none shadow-lg shadow-blue-500/20 active:scale-95 transition-all w-full md:w-auto justify-center"
                  >
                    {isPending ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        <span>Проведение...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-4 w-4" />
                        <span>Провести поставку</span>
                      </>
                    )}
                  </Button>
                )}
              </div>

            </CardContent>
          </Card>
        </div>

      </div>

      {/* Full screen photo modal */}
      {showFullImage && order.imageUrl && (
        <div className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-4 backdrop-blur-md">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setShowFullImage(false)} 
            className="absolute top-4 right-4 text-white hover:bg-white/10 rounded-full h-12 w-12"
          >
            <X className="h-6 w-6" />
          </Button>
          
          <div className="max-w-4xl max-h-[85vh] w-full h-full relative flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img 
              src={order.imageUrl} 
              alt="Накладная в полный экран" 
              className="object-contain w-full h-full max-h-[85vh]"
            />
          </div>
          <div className="text-white/60 text-xs font-bold uppercase tracking-wider mt-4">
            Накладная №{order.id.slice(-6).toUpperCase()} • {order.supplierName}
          </div>
        </div>
      )}

    </div>
  );
}
