'use client';

import React, { useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { useCollection, useFirestore } from '@/firebase/hooks';
import { collection, query, orderBy } from 'firebase/firestore';
import { useMemoFirebase, useFirebase } from '@/firebase/provider';

import { 
  FileText, ChevronRight, RefreshCw, Truck, Zap, 
  ImagePlus, Loader2, Sparkles, History, Layers, ClipboardCheck
} from 'lucide-react';
import { OrderRequest, ERPItem, Contractor } from '@/lib/types/erp';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { runReceiptOCRAction, uploadSupplyImageAction } from '@/app/actions/ai-ocr-actions';
import { getSmartIngredientMatchesAction } from '@/app/actions/ai-matching-actions';
import { createDraftFromOCRAction } from '@/app/orders/actions';

export default function OrdersPage() {
  const { toast } = useToast();
  const router = useRouter();
  const firestore = useFirestore();
  const { orgId } = useFirebase();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanStep, setScanStep] = useState<string>('');

  const ordersQuery = useMemoFirebase(() => {
    if (!firestore || !orgId) return null;
    return query(
      collection(firestore, 'organizations', orgId, 'order_requests'), 
      orderBy('createdAt', 'desc')
    );
  }, [firestore, orgId]);


  const suppliersQuery = useMemoFirebase(() => {
    if (!firestore || !orgId) return null;
    return query(collection(firestore, 'organizations', orgId, 'suppliers'), orderBy('name', 'asc'));
  }, [firestore, orgId]);

  const { data: orders, isLoading } = useCollection<OrderRequest>(ordersQuery);
  const { data: suppliers } = useCollection<Contractor>(suppliersQuery);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanning(true);
    setScanStep('Чтение файла...');
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(',')[1];
        
        // 1. OCR Extract
        setScanStep('Сканирование ИИ (OCR)...');
        const ocrResult = await runReceiptOCRAction(base64, file.type, orgId || undefined);
        if (!ocrResult || !ocrResult.items || ocrResult.items.length === 0) {
          toast({ 
            variant: 'destructive', 
            title: 'Не удалось распознать накладную', 
            description: 'Попробуйте сделать более четкое фото накладной.' 
          });
          setIsScanning(false);
          return;
        }

        // 2. Match Contractor
        setScanStep('Поиск поставщика...');
        let matchedSupplierId = '';
        let matchedSupplierName = 'Неизвестный поставщик';
        if (ocrResult.counterpartyInn && suppliers) {
          const found = suppliers.find(s => s.inn === ocrResult.counterpartyInn);
          if (found) {
            matchedSupplierId = found.id;
            matchedSupplierName = found.name;
          }
        }
        if (!matchedSupplierId && ocrResult.counterparty && suppliers) {
          const lowerName = ocrResult.counterparty.toLowerCase();
          const found = suppliers.find(s => 
            s.name.toLowerCase().includes(lowerName) || 
            lowerName.includes(s.name.toLowerCase())
          );
          if (found) {
            matchedSupplierId = found.id;
            matchedSupplierName = found.name;
          }
        }

        // 3. AI Item Matching
        setScanStep('Сопоставление товаров в базе ERP...');
        if (!orgId) {
          toast({ variant: 'destructive', title: 'Ошибка', description: 'Организация не определена' });
          return;
        }
        const matches = await getSmartIngredientMatchesAction(orgId, ocrResult.items || [], matchedSupplierId);
        
        const mappedItems = matches.map(m => {
          const scannedItem = ocrResult.items?.find(si => si.name === m.scannedName);
          return {
            itemId: m.matchedItemId || '',
            name: m.scannedName,
            count: scannedItem?.qty || 1,
            pricePerUnit: scannedItem?.price || 0,
            unit: 'кг', // Default
            invoiceWeight: scannedItem?.qty || 1,
            finalWeight: scannedItem?.qty || 1,
          };
        });

        // 4. Upload photo to storage
        setScanStep('Сохранение фотографии...');
        const fileName = `supply_${Date.now()}_${file.name}`;
        const uploadResult = await uploadSupplyImageAction(base64, fileName, file.type);

        // 5. Create draft in Firestore
        setScanStep('Создание черновика...');
        const createResult = await createDraftFromOCRAction({
          orgId: orgId || 'super_org',
          items: mappedItems,
          supplierId: matchedSupplierId,
          supplierName: matchedSupplierName,
          locationId: '1', // Основной склад по умолчанию
          locationName: 'Основной Склад',
          imageUrl: uploadResult?.url || '',
          comment: ocrResult.comment || 'Загружено из поставочного листа',
        });


        if (createResult.success) {
          toast({ 
            title: 'Накладная обработана!', 
            description: `Найдено позиций: ${mappedItems.length}. Перенаправляем на сверку.` 
          });
          router.push(`/orders/${createResult.id}`);
        } else {
          throw new Error(createResult.error || 'Ошибка записи черновика.');
        }
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      toast({ 
        variant: 'destructive', 
        title: 'Ошибка распознавания', 
        description: err.message || String(err) 
      });
    } finally {
      setIsScanning(false);
      setScanStep('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Active Drafts/Acceptance (DRAFT, NEED_REVIEW, WAITING, APPROVED, etc.)
  const activeOrders = orders?.filter(o => 
    ['DRAFT', 'NEED_REVIEW', 'APPROVED', 'SUPPLIER_CONFIRMED', 'VERIFIED_ON_GATE', 'FINAL_WEIGHTED'].includes(o.status)
  ) || [];

  // Completed Invoices (POSTED_TO_POSTER, ARCHIVED)
  const archivedOrders = orders?.filter(o => 
    ['POSTED_TO_POSTER', 'ARCHIVED'].includes(o.status)
  ) || [];

  return (
    <div className="space-y-8 mt-8">
      {/* Header and Upload Action */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-2">
        <PageHeader 
          title="Приемка по Фото" 
          description="Быстрый импорт поставок: загрузите накладную, ИИ распознает товары, а вы подтвердите фактический вес." 
        />
        
        <div className="flex items-center gap-4">
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept="image/*" 
            onChange={handleFileChange} 
          />
          <Button 
            disabled={isScanning}
            onClick={handleUploadClick}
            className="h-14 px-8 bg-blue-600 hover:bg-blue-700 text-white font-black uppercase text-[11px] tracking-widest rounded-2xl shadow-lg border-none flex items-center gap-3 active:scale-95 transition-all"
          >
            {isScanning ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>{scanStep || 'Сканирование...'}</span>
              </>
            ) : (
              <>
                <ImagePlus className="h-5 w-5" />
                <span>Загрузить накладную по фото</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Grid of active drafts */}
      <div className="space-y-6">
        <div className="flex items-center gap-3 px-2">
          <div className="w-10 h-10 rounded-2xl bg-amber-100 flex items-center justify-center">
            <Truck className="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <h2 className="text-lg font-black uppercase tracking-tighter text-slate-800 leading-none">Зона приемки (Черновики)</h2>
            <p className="text-[10px] font-black uppercase text-slate-400 mt-1 tracking-widest leading-none">
              Поставки, ожидающие сверки цен, количества и фактического веса
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-20 animate-pulse text-slate-400 font-bold uppercase tracking-widest text-xs">
            Загрузка черновиков...
          </div>
        ) : activeOrders.length === 0 ? (
          <Card className="border-2 border-dashed border-slate-200 bg-white/50 rounded-[2rem] p-12 text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-4">
              <ClipboardCheck className="h-6 w-6 text-slate-400" />
            </div>
            <h3 className="font-bold text-slate-700 text-sm">Зона приемки пуста</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto mt-2">
              Загрузите фотографию поставочного листа выше, чтобы ИИ распознал товары и создал черновик приемки.
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {activeOrders.map((order) => {
              const totalItems = order.items?.length || 0;
              const dateText = order.createdAt ? format(order.createdAt.toDate(), 'dd MMMM yyyy, HH:mm', { locale: ru }) : '—';
              
              return (
                <Card key={order.id} className="border-none shadow-md bg-white rounded-[2rem] overflow-hidden flex flex-col justify-between hover:shadow-xl transition-all duration-300">
                  <div className="p-6 space-y-4">
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                          Накладная #{order.id.slice(-6).toUpperCase()}
                        </span>
                        <h3 className="font-black text-slate-800 uppercase text-base leading-tight tracking-tight">
                          {order.supplierName || 'Неизвестный поставщик'}
                        </h3>
                      </div>
                      <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[9px] font-black uppercase rounded-lg px-2.5 py-0.5">
                        {order.status === 'DRAFT' ? 'Черновик' : 'На сверке'}
                      </Badge>
                    </div>

                    <div className="text-xs text-slate-500 flex flex-col gap-1.5 bg-slate-50 rounded-xl p-3 border border-slate-100">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Склад:</span>
                        <span className="font-bold text-slate-700">{order.locationName || 'Основной Склад'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Позиций:</span>
                        <span className="font-bold text-slate-700">{totalItems} шт.</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Дата:</span>
                        <span className="font-medium text-slate-700">{dateText}</span>
                      </div>
                    </div>

                    {order.imageUrl && (
                      <div className="h-28 w-full relative rounded-xl overflow-hidden border border-slate-100">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img 
                          src={order.imageUrl} 
                          alt="Поставочный лист" 
                          className="object-cover w-full h-full filter brightness-95" 
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
                        <div className="absolute bottom-2 left-2 flex items-center gap-1.5 bg-black/50 text-white rounded-md text-[9px] px-2 py-0.5 font-bold uppercase tracking-wider backdrop-blur-sm">
                          <Sparkles className="w-2.5 h-2.5 text-blue-300" /> Скан накладной
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="px-6 pb-6 pt-2">
                    <Button asChild className="w-full h-12 bg-slate-900 hover:bg-black text-white font-black uppercase text-[10px] tracking-widest rounded-xl flex items-center gap-2 border-none">
                      <Link href={`/orders/${order.id}`}>
                        <span>Принять и взвесить</span>
                        <ChevronRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Completed Archive Table */}
      <div className="space-y-6 pt-6">
        <div className="flex items-center gap-3 px-2">
          <div className="w-10 h-10 rounded-2xl bg-slate-100 flex items-center justify-center">
            <History className="h-5 w-5 text-slate-600" />
          </div>
          <div>
            <h2 className="text-lg font-black uppercase tracking-tighter text-slate-800 leading-none">Архив завершенных поставок</h2>
            <p className="text-[10px] font-black uppercase text-slate-400 mt-1 tracking-widest leading-none">
              Поставки, успешно проведенные в Poster и записанные в бухгалтерию
            </p>
          </div>
        </div>

        <Card className="border-none shadow-md bg-white rounded-[2rem] overflow-hidden">
          <Table>
            <TableHeader className="bg-slate-50/50">
              <TableRow className="border-slate-100">
                <TableHead className="py-4 pl-8 text-[10px] uppercase font-black tracking-widest text-slate-400">Дата</TableHead>
                <TableHead className="py-4 text-[10px] uppercase font-black tracking-widest text-slate-400">Поставщик</TableHead>
                <TableHead className="py-4 text-[10px] uppercase font-black tracking-widest text-slate-400 text-center">Склад</TableHead>
                <TableHead className="py-4 text-[10px] uppercase font-black tracking-widest text-slate-400 text-right">Сумма</TableHead>
                <TableHead className="py-4 text-[10px] uppercase font-black tracking-widest text-slate-400 text-center">Статус</TableHead>
                <TableHead className="py-4 pr-8 text-right text-[10px] uppercase font-black tracking-widest text-slate-400">Детали</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center animate-pulse font-black uppercase text-[10px] text-slate-300">
                    Загрузка...
                  </TableCell>
                </TableRow>
              ) : archivedOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center font-black uppercase text-[10px] text-slate-300 italic opacity-50">
                    Проведенных поставок нет
                  </TableCell>
                </TableRow>
              ) : (
                archivedOrders.map((order) => {
                  const dateText = order.createdAt ? format(order.createdAt.toDate(), 'dd.MM.yyyy HH:mm') : '—';
                  const totalSum = order.totalPrice || order.items?.reduce((acc, item) => acc + ((item.finalWeight || item.count) * (item.pricePerUnit || 0)), 0) || 0;
                  
                  return (
                    <TableRow key={order.id} className="hover:bg-slate-50/20 transition-colors border-b last:border-0 border-slate-100 h-16">
                      <TableCell className="pl-8 py-4 font-semibold text-xs text-slate-600">
                        {dateText}
                      </TableCell>
                      <TableCell className="py-4">
                        <div className="flex flex-col">
                          <span className="font-black text-slate-800 text-sm uppercase tracking-tight leading-none">
                            {order.supplierName}
                          </span>
                          <span className="text-[9px] font-bold text-slate-400 mt-1">
                            ID: #{order.id.slice(-6).toUpperCase()}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="py-4 text-center font-bold text-xs text-slate-600">
                        {order.locationName || 'Основной Склад'}
                      </TableCell>
                      <TableCell className="py-4 text-right font-black text-sm text-slate-900 tabular-nums">
                        {totalSum.toLocaleString()} <span className="text-[10px] text-slate-400">сум</span>
                      </TableCell>
                      <TableCell className="py-4 text-center">
                        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[9px] font-black uppercase rounded-lg px-2.5 py-0.5">
                          Проведено
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right pr-8 py-4">
                        <Button asChild variant="ghost" className="rounded-xl h-10 text-slate-500 hover:text-slate-900 hover:bg-slate-50 transition-colors text-[10px] font-black uppercase tracking-wider">
                          <Link href={`/orders/${order.id}`}>
                            Просмотреть
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </Card>
      </div>
    </div>
  );
}
