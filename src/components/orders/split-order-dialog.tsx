'use client';

import React, { useState, useMemo } from 'react';
import { 
    Dialog, DialogContent, DialogHeader, DialogTitle, 
    DialogDescription, DialogFooter 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
    Truck, AlertCircle, CheckCircle2, 
    ChevronRight, ArrowRight, UserCheck,
    Building2, X, RefreshCw, ShieldCheck
} from 'lucide-react';
import { OrderRequest, OrderItem, Supplier, ERPItem } from '@/lib/types/erp';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';

interface SplitOrderDialogProps {
    order: OrderRequest;
    suppliers: Supplier[];
    erpItems: ERPItem[];
    onConfirm: (assignments: Record<string, OrderItem[]>) => Promise<void>;
    onClose: () => void;
}

export function SplitOrderDialog({ order, suppliers, erpItems, onConfirm, onClose }: SplitOrderDialogProps) {
    const [isProcessing, setIsProcessing] = useState(false);
    
    // items: array of { originalIndex, count, pricePerUnit, excluded: boolean }
    const [itemEdits, setItemEdits] = useState<Record<number, { count: number, price: number, excluded: boolean }>>(() => {
        const initial: Record<number, { count: number, price: number, excluded: boolean }> = {};
        order.items.forEach((item, idx) => {
            initial[idx] = { count: item.count, price: item.pricePerUnit || 0, excluded: false };
        });
        return initial;
    });

    const [assignments, setAssignments] = useState<Record<string, string>>(() => {
        const initial: Record<string, string> = {};
        order.items.forEach((item, idx) => {
            const erpItem = erpItems.find(i => i.id === item.itemId);
            initial[idx] = erpItem?.preferredSupplierId || 'UNASSIGNED';
        });
        return initial;
    });

    const [supplierComments, setSupplierComments] = useState<Record<string, string>>({});

    const groups = useMemo(() => {
        const result: Record<string, { supplier: Supplier | null, total: number, items: (OrderItem & { originalIndex: number, currentPrice: number, currentCount: number })[] }> = {};
        
        order.items.forEach((item, idx) => {
            if (itemEdits[idx]?.excluded) return;
            const sId = assignments[idx];
            if (!result[sId]) {
                const s = suppliers.find(sup => sup.id === sId);
                result[sId] = { supplier: s || null, items: [], total: 0 };
            }
            const edit = itemEdits[idx] || { count: item.count, price: item.pricePerUnit || 0 };
            const itemTotal = edit.count * edit.price;
            result[sId].items.push({ 
                ...item, 
                originalIndex: idx, 
                currentCount: edit.count, 
                currentPrice: edit.price 
            });
            result[sId].total += itemTotal;
        });
        
        return result;
    }, [assignments, itemEdits, order.items, suppliers]);

    const handleConfirm = async (singleSId?: string) => {
        setIsProcessing(true);
        try {
            const finalGroups: Record<string, OrderItem[]> = {};
            
            if (singleSId) {
                const data = groups[singleSId];
                finalGroups[singleSId] = data.items.map(({ originalIndex, currentCount, currentPrice, ...rest }) => ({
                    ...rest,
                    count: currentCount,
                    pricePerUnit: currentPrice,
                    totalPrice: currentCount * currentPrice,
                    comment: supplierComments[singleSId] || rest.comment
                }));
            } else {
                Object.entries(groups).forEach(([sId, data]) => {
                    if (sId !== 'UNASSIGNED') {
                        finalGroups[sId] = data.items.map(({ originalIndex, currentCount, currentPrice, ...rest }) => ({
                            ...rest,
                            count: currentCount,
                            pricePerUnit: currentPrice,
                            totalPrice: currentCount * currentPrice,
                            comment: supplierComments[sId] || rest.comment
                        }));
                    }
                });
            }
            await onConfirm(finalGroups);
        } catch (e) {
            console.error(e);
        } finally {
            setIsProcessing(false);
        }
    };

    const unassignedCount = groups['UNASSIGNED']?.items.length || 0;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xl">
            <div className="bg-white w-full max-w-6xl rounded-[3rem] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.3)] overflow-hidden flex flex-col max-h-[95vh] border border-white/40">
                <div className="p-10 bg-gradient-to-br from-slate-50 to-white border-b flex items-center justify-between">
                    <div>
                        <h2 className="text-3xl font-black uppercase tracking-tighter text-slate-800 flex items-center gap-4">
                            <div className="p-3 bg-primary rounded-2xl shadow-lg shadow-blue-100"><Truck className="h-7 w-7 text-white" /></div>
                            Центр Контроля Закупок
                        </h2>
                        <p className="text-xs font-black text-slate-400 mt-2 uppercase tracking-widest flex items-center gap-2">
                             <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                             Гибкая настройка накладных перед окончательным формированием
                        </p>
                    </div>
                    <div className="flex items-center gap-4">
                        {unassignedCount > 0 && (
                            <div className="bg-rose-50 text-rose-600 border border-rose-100 px-6 py-3 rounded-2xl flex items-center gap-3">
                                <AlertCircle className="h-5 w-5" />
                                <span className="font-black uppercase text-[10px] tracking-widest">Внимание: {unassignedCount} не распределено</span>
                            </div>
                        )}
                        <Button variant="outline" onClick={onClose} className="rounded-2xl h-12 border-slate-200 font-bold uppercase text-[10px]">Закрыть</Button>
                    </div>
                </div>

                <ScrollArea className="flex-1 p-10 bg-slate-50/50">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pb-10">
                        {Object.entries(groups).map(([sId, data]) => (
                            <div key={sId} className={cn(
                                "rounded-[2.5rem] border-2 transition-all flex flex-col shadow-sm hover:shadow-xl group",
                                sId === 'UNASSIGNED' ? "border-amber-200 bg-amber-50/30" : "border-slate-100 bg-white"
                            )}>
                                <div className={cn(
                                    "p-6 flex items-center justify-between border-b-2",
                                    sId === 'UNASSIGNED' ? "border-amber-100 bg-amber-50/50" : "border-slate-50 bg-slate-50/30"
                                )}>
                                    <div className="flex items-center gap-4">
                                        <div className={cn(
                                            "w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg",
                                            sId === 'UNASSIGNED' ? "bg-amber-400 text-white" : "bg-slate-800 text-white"
                                        )}>
                                            {sId === 'UNASSIGNED' ? <AlertCircle className="h-6 w-6" /> : <Building2 className="h-6 w-6" />}
                                        </div>
                                        <div>
                                            <h3 className="font-black uppercase text-base tracking-tight text-slate-700">
                                                {data.supplier?.name || "Требует внимания"}
                                            </h3>
                                            <div className="flex items-center gap-2 mt-1">
                                                <Badge variant="outline" className="font-black text-[9px] uppercase">{data.items.length} ПОЗИЦИЙ</Badge>
                                                {sId !== 'UNASSIGNED' && <span className="text-[10px] font-black text-emerald-600 uppercase">Счет: {data.total.toLocaleString()} сум</span>}
                                            </div>
                                        </div>
                                    </div>
                                    {sId !== 'UNASSIGNED' && (
                                        <Button 
                                            size="sm" 
                                            variant="secondary" 
                                            onClick={() => handleConfirm(sId)}
                                            disabled={isProcessing}
                                            className="rounded-xl h-10 px-4 bg-emerald-500 hover:bg-emerald-600 text-white font-black uppercase text-[9px] shadow-lg shadow-emerald-100"
                                        >
                                            Сформировать только эту
                                        </Button>
                                    )}
                                </div>

                                <div className="p-6 space-y-3 flex-1">
                                    {data.items.map((item, idx) => (
                                        <div key={idx} className="bg-slate-50/50 p-4 rounded-2xl flex flex-col gap-3 border border-slate-100">
                                            <div className="flex items-start justify-between">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-black text-xs uppercase text-slate-700">{item.name}</span>
                                                        <Button 
                                                            variant="ghost" 
                                                            size="icon" 
                                                            className="h-6 w-6 rounded-full text-slate-300 hover:text-rose-500"
                                                            onClick={() => setItemEdits({ ...itemEdits, [item.originalIndex]: { ...itemEdits[item.originalIndex], excluded: true } })}
                                                        >
                                                            <X className="h-3 w-3" />
                                                        </Button>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] font-black text-slate-400 uppercase">Поставщик:</span>
                                                    <Select 
                                                        value={assignments[item.originalIndex]} 
                                                        onValueChange={(v) => setAssignments({ ...assignments, [item.originalIndex]: v })}
                                                    >
                                                        <SelectTrigger className="w-[140px] h-8 rounded-lg border-none bg-white shadow-sm text-[9px] font-black uppercase">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent className="rounded-xl">
                                                            <SelectItem value="UNASSIGNED" className="text-[9px] font-bold text-amber-600">ВЫБРАТЬ...</SelectItem>
                                                            {suppliers.map(s => (
                                                                <SelectItem key={s.id} value={s.id} className="text-[9px] font-bold uppercase">{s.name}</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            </div>
                                            
                                            <div className="flex items-center gap-6 pt-1 border-t border-slate-100/50">
                                                <div className="grid gap-1">
                                                    <label className="text-[8px] font-black text-slate-300 uppercase">Кол-во</label>
                                                    <div className="flex items-center gap-2 bg-white px-2 rounded-lg border border-slate-100 shadow-sm">
                                                        <Input 
                                                            type="number" 
                                                            value={item.currentCount} 
                                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setItemEdits({ ...itemEdits, [item.originalIndex]: { ...itemEdits[item.originalIndex], count: parseFloat(e.target.value) || 0 } })}
                                                            className="w-16 h-8 p-0 border-none text-center font-black text-xs focus-visible:ring-0"
                                                        />
                                                        <span className="text-[9px] font-bold text-slate-400 uppercase">{item.unit}</span>
                                                    </div>
                                                </div>
                                                <div className="grid gap-1">
                                                    <label className="text-[8px] font-black text-slate-300 uppercase">Цена</label>
                                                    <div className="flex items-center gap-2 bg-white px-2 rounded-lg border border-slate-100 shadow-sm">
                                                        <Input 
                                                            type="number" 
                                                            value={item.currentPrice} 
                                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setItemEdits({ ...itemEdits, [item.originalIndex]: { ...itemEdits[item.originalIndex], price: parseFloat(e.target.value) || 0 } })}
                                                            className="w-20 h-8 p-0 border-none text-center font-black text-xs focus-visible:ring-0"
                                                        />
                                                        <span className="text-[9px] font-bold text-slate-400">сум</span>
                                                    </div>
                                                </div>
                                                <div className="ml-auto text-right">
                                                    <div className="text-[8px] font-black text-slate-300 uppercase">Итого</div>
                                                    <div className="text-xs font-black text-slate-800">{(item.currentCount * item.currentPrice).toLocaleString()} сум</div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {sId !== 'UNASSIGNED' && (
                                    <div className="p-6 bg-slate-50/50 border-t-2 border-slate-100">
                                        <label className="text-[9px] font-black text-slate-400 uppercase mb-2 block">Комментарий для {data.supplier?.name}</label>
                                        <textarea 
                                            value={supplierComments[sId] || ''}
                                            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setSupplierComments({ ...supplierComments, [sId]: e.target.value })}
                                            placeholder="Уточнения по доставке, времени и т.д."
                                            className="w-full rounded-2xl border-2 border-slate-100 p-4 text-xs font-bold focus:border-primary outline-none transition-all placeholder:text-slate-200 h-20 resize-none"
                                        />
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </ScrollArea>

                <div className="p-10 bg-white border-t flex items-center justify-between">
                    <div className="flex items-center gap-6">
                        <div className="grid gap-0.5">
                            <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest leading-none">Общая сумма закупа</span>
                            <span className="text-3xl font-black text-slate-900 tracking-tighter">
                                {Object.values(groups).reduce((acc, g) => acc + (g.supplier ? g.total : 0), 0).toLocaleString()} сум
                            </span>
                        </div>
                        <div className="h-10 w-px bg-slate-100" />
                        <div className="grid gap-0.5">
                            <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest leading-none">Накладных (блоков)</span>
                            <span className="text-xl font-black text-primary">{Object.keys(groups).filter(k => k !== 'UNASSIGNED').length} ФАЙЛА</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <Button 
                            onClick={() => handleConfirm()} 
                            disabled={isProcessing || unassignedCount > 0} 
                            className="rounded-[2rem] h-16 px-16 bg-slate-900 hover:bg-black shadow-2xl font-black uppercase tracking-widest text-[11px] text-white flex items-center gap-3 transition-all active:scale-95 disabled:grayscale"
                        >
                            {isProcessing ? <RefreshCw className="animate-spin h-5 w-5" /> : <ShieldCheck className="h-5 w-5 fill-emerald-500 text-white" />}
                            Сформировать все накладные
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
