'use client';

import React, { useState, useTransition, useMemo } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
    RefreshCw, 
    Plus, 
    Truck, 
    Search,
    Trash2,
    Link as LinkIcon,
    LayoutGrid,
    Boxes,
    Star,
    Package
} from 'lucide-react';
import { syncItemsFromPosterAction } from '@/app/actions/flow-core';
import { collection, query, orderBy, deleteDoc, addDoc, serverTimestamp, doc } from 'firebase/firestore';
import { useFirestore, useCollection } from '@/firebase/hooks';
import { useMemoFirebase, useFirebase } from '@/firebase/provider';
import { ERPItem, Contractor } from '@/lib/types/erp';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { SearchableSelect } from '@/components/ui/searchable-select';

// ContractorItem: СВЯЗКА между нашим ингредиентом и поставщиком
interface ContractorItem {
    id: string;
    contractorId: string;      // ID из коллекции contractors (Банки и Счета)
    linkedErpItemId: string;   // ID нашего ингредиента из erp_items
    supplierName: string;      // Как этот товар называется у поставщика
    pricePerUnit: number;      // Цена за единицу
    unit: string;              // Единица измерения
    isPreferred: boolean;      // Основной поставщик?
}

interface FlowCategory {
    id: string;
    posterId: any;
    name: string;
    order: number;
}

export default function IngredientsPage() {
    const { toast } = useToast();
    const { orgId } = useFirebase();
    const [isPending, startTransition] = useTransition();
    const firestore = useFirestore();
    const [searchTerm, setSearchTerm] = useState('');
    const [logisticsSearch, setLogisticsSearch] = useState('');
    const [selectedContractorId, setSelectedContractorId] = useState<string>('');

    // --- QUERIES ---
    const erpItemsQuery = useMemoFirebase(() => {
        if (!firestore || !orgId) return null;
        return query(collection(firestore, 'organizations', orgId, 'erp_items'), orderBy('name', 'asc'));
    }, [firestore, orgId]);
    const { data: rawItems } = useCollection<ERPItem>(erpItemsQuery);

    const categoriesQuery = useMemoFirebase(() => 
        (firestore && orgId) ? query(collection(firestore, 'organizations', orgId, 'categories'), orderBy('order', 'asc')) : null, [firestore, orgId]);
    const { data: categories } = useCollection<FlowCategory>(categoriesQuery as any);

    const contractorItemsQuery = useMemoFirebase(() => {
        if (!firestore || !orgId) return null;
        return query(collection(firestore, 'organizations', orgId, 'contractor_items'), orderBy('contractorId', 'asc'));
    }, [firestore, orgId]);
    const { data: contractorItems } = useCollection<ContractorItem>(contractorItemsQuery);

    const contractorsQuery = useMemoFirebase(() => {
        if (!firestore || !orgId) return null;
        return query(collection(firestore, 'organizations', orgId, 'contractors'), orderBy('name', 'asc'));
    }, [firestore, orgId]);
    const { data: contractors } = useCollection<Contractor>(contractorsQuery);

    const handleSync = async () => {
        if (!orgId) return;
        startTransition(async () => {
            const result = await syncItemsFromPosterAction(orgId);
            if (result.success) {
                toast({ title: 'Синхронизация завершена' });
            } else {
                toast({ variant: 'destructive', title: 'Ошибка синхронизации', description: result.message });
            }
        });
    };

    // --- ПРЯМАЯ ГРУППИРОВКА ПО POSTER ID (Парсинг по числам 2,3,4,5) ---
    const groupedItems = useMemo(() => {
        if (!rawItems) return {};
        const filtered = rawItems.filter(i => (i.name || '').toLowerCase().includes(searchTerm.toLowerCase()));
        
        const groups: Record<string, { name: string, items: ERPItem[] }> = {};

        // 1. Инициализируем блоки ПО ТВОИМ НАСТРОЙКАМ (чтобы сохранить названия и порядок)
        // Делаем копию массива [...(categories || [])] перед сортировкой, чтобы избежать TypeError на read-only массивах
        const sortedCats = [...(categories || [])].sort((a,b) => (Number(a.order) || 0) - (Number(b.order) || 0));
        sortedCats.forEach(cat => {
            const posterIdStr = String(cat.posterId || '');
            groups[posterIdStr] = { name: cat.name || 'Без названия', items: [] };
        });

        // 2. Раскидываем продукты
        filtered.forEach(item => {
            const itemCatId = String(item.categoryId || '');
            
            if (groups[itemCatId]) {
                groups[itemCatId].items.push(item);
            } else {
                if (!groups['other']) groups['other'] = { name: 'Без категории', items: [] };
                groups['other'].items.push(item);
            }
        });

        if (searchTerm) {
            Object.keys(groups).forEach(k => { if (groups[k].items.length === 0) delete groups[k]; });
        }
        
        return groups;
    }, [rawItems, categories, searchTerm]);

    return (
        <div className="space-y-6 pb-20 p-4 max-w-[1400px] mx-auto overflow-hidden">
             <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <PageHeader title="База Ингредиентов" description="Управление продуктами по блокам из Poster." />
                <div className="flex items-center gap-4">
                    <div className="relative group w-72">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-all group-focus-within:text-primary" />
                        <Input placeholder="Быстрый поиск..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-11 h-12 rounded-[1.5rem] bg-card border-none shadow-xl font-bold transition-all focus:ring-4 ring-primary/10" />
                    </div>
                    <Button onClick={handleSync} disabled={isPending} variant="outline" className="rounded-2xl border-2 h-12 px-8 font-black uppercase text-[10px] tracking-widest bg-white shadow-xl hover:bg-slate-50 transition-all">
                        <RefreshCw className={cn("mr-3 h-5 w-5 text-primary", isPending && "animate-spin")} /> Poster Sync
                    </Button>
                </div>
            </div>

            <Tabs defaultValue="poster" className="w-full">
                <TabsList className="bg-muted/40 p-2 rounded-[2.5rem] h-18 border-2 shadow-inner mb-12 flex overflow-x-auto whitespace-nowrap scrollbar-hide">
                    <TabsTrigger value="poster" className="flex-1 px-12 rounded-[1.8rem] font-black uppercase text-[11px] tracking-[0.2em] flex items-center justify-center gap-3 data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-2xl transition-all duration-300">
                        <Boxes className="w-5 h-5" /> Справочник (Блоки)
                    </TabsTrigger>
                    <TabsTrigger value="logistics" className="flex-1 px-12 rounded-[1.8rem] font-black uppercase text-[11px] tracking-[0.2em] flex items-center justify-center gap-3 data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-2xl transition-all duration-300">
                        <Package className="w-5 h-5" /> Ингредиенты Контрагентов
                    </TabsTrigger>
                </TabsList>

                {/* --- ТАБ 1: КЛАССИЧЕСКИЕ БЛОКИ (ПО НОМЕРАМ POSTER ID) --- */}
                <TabsContent value="poster" className="space-y-16 animate-in fade-in slide-in-from-bottom-10 duration-1000">
                    {Object.keys(groupedItems).sort((a,b) => a === 'other' ? 1 : b === 'other' ? -1 : 0).map(groupId => {
                        const group = groupedItems[groupId];
                        if (group.items.length === 0 && searchTerm) return null;
                        
                        return (
                            <div key={groupId} className="space-y-8">
                                <div className="flex items-center gap-8 px-6">
                                    <h2 className="text-[14px] font-black uppercase tracking-[0.6em] text-primary whitespace-nowrap bg-white px-14 py-5 rounded-[3rem] border-2 border-primary/5 flex items-center gap-6 shadow-2xl ring-8 ring-primary/5 transition-all">
                                        <div className="p-2 bg-primary/5 rounded-2xl"><LayoutGrid className="h-5 w-5 text-primary" /></div>
                                        {group.name}
                                        <Badge className="bg-primary text-white border-none font-black px-4 py-1.5 rounded-2xl shadow-xl ring-4 ring-white">
                                            {group.items.length}
                                        </Badge>
                                        <span className="text-[9px] font-bold text-muted-foreground/30 lowercase tracking-widest bg-slate-50 px-3 py-1 rounded-full border-2">ID: {groupId}</span>
                                    </h2>
                                    <div className="h-[2px] bg-gradient-to-r from-primary/10 via-primary/5 to-transparent flex-1" />
                                </div>

                                <Card className="rounded-[4.5rem] border-none shadow-[0_50px_100px_-25px_rgba(0,0,0,0.12)] overflow-hidden bg-white transition-all hover:shadow-[0_65px_120px_-30px_rgba(0,0,0,0.15)] ring-1 ring-black/5 mx-2 pb-10">
                                    <Table>
                                        <TableHeader><TableRow className="bg-muted/10 border-none h-24">
                                            <TableHead className="font-black text-[11px] uppercase pl-20 tracking-widest text-muted-foreground/40">Название Ингредиента</TableHead>
                                            <TableHead className="font-black text-[11px] uppercase text-center tracking-widest text-muted-foreground/40">Ед. Изм.</TableHead>
                                            <TableHead className="font-black text-[11px] uppercase text-right pr-20 tracking-widest text-muted-foreground/40">Poster ID</TableHead>
                                        </TableRow></TableHeader>
                                        <TableBody className="border-none">
                                            {group.items.map(item => (
                                                <TableRow key={item.id} className="hover:bg-primary/[0.02] border-none transition-all group border-b border-muted/10 last:border-none">
                                                    <TableCell className="pl-20 py-8 leading-none">
                                                        <span className="font-black uppercase text-[18px] tracking-tighter text-slate-800 group-hover:text-primary transition-colors block mb-1">
                                                            {item.name}
                                                        </span>
                                                        <span className="text-[9px] font-bold text-muted-foreground/30 uppercase tracking-[0.2em] flex items-center gap-2">
                                                            <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full" /> Принадлежность: {groupId}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        <Badge variant="outline" className="rounded-[1rem] font-black text-[11px] uppercase border-none bg-slate-100 text-slate-400 px-6 py-2.5 shadow-sm">
                                                            {item.baseUnit}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-right pr-20 font-mono text-[12px] font-bold text-muted-foreground/10 group-hover:text-primary/10 transition-all tracking-tight">
                                                        #{item.posterId}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </Card>
                            </div>
                        )
                    })}
                </TabsContent>

                {/* --- ТАБ 2: ИНГРЕДИЕНТЫ КОНТРАГЕНТОВ --- */}
                <TabsContent value="logistics" className="space-y-8 animate-in fade-in duration-500">
                    {/* ПАНЕЛЬ УПРАВЛЕНИЯ */}
                    <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white p-6 rounded-[2.5rem] shadow-xl border-2 border-slate-50 mx-2">
                        <div className="flex items-center gap-4 flex-1">
                            <div className="relative flex-1 max-w-sm">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input 
                                    placeholder="Поиск по ингредиенту..." 
                                    value={logisticsSearch} 
                                    onChange={e => setLogisticsSearch(e.target.value)} 
                                    className="pl-11 h-12 rounded-2xl border-none bg-slate-50 shadow-inner font-bold" 
                                />
                            </div>
                            <SearchableSelect 
                                options={[{value:'', label:'Все контрагенты'}, ...(contractors||[]).map(c=>({value:c.id, label:c.name}))]} 
                                value={selectedContractorId} 
                                onChange={setSelectedContractorId} 
                                placeholder="Фильтр по поставщику..."
                            />
                        </div>
                        <LinkIngredientDialog contractors={contractors||[]} erpItems={rawItems||[]} firestore={firestore} orgId={orgId} />
                    </div>

                    {/* ТАБЛИЦА СВЯЗОК */}
                    <Card className="rounded-[3.5rem] border-none shadow-2xl overflow-hidden mx-2">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-indigo-50/50 border-none h-20">
                                    <TableHead className="font-black text-[11px] uppercase pl-12 tracking-widest text-indigo-400">Наш Ингредиент (FLOW)</TableHead>
                                    <TableHead className="font-black text-[11px] uppercase tracking-widest text-indigo-400">У Поставщика</TableHead>
                                    <TableHead className="font-black text-[11px] uppercase tracking-widest text-indigo-400">Поставщик</TableHead>
                                    <TableHead className="font-black text-[11px] uppercase text-right tracking-widest text-indigo-400">Цена / ед.</TableHead>
                                    <TableHead className="w-20"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {(contractorItems||[])
                                    .filter(ci => {
                                        const erpItem = rawItems?.find(i => i.id === ci.linkedErpItemId);
                                        const matchSearch = !logisticsSearch || 
                                            (erpItem?.name || '').toLowerCase().includes(logisticsSearch.toLowerCase()) ||
                                            (ci.supplierName || '').toLowerCase().includes(logisticsSearch.toLowerCase());
                                        const matchContractor = !selectedContractorId || ci.contractorId === selectedContractorId;
                                        return matchSearch && matchContractor;
                                    })
                                    .map(ci => {
                                        const erpItem = rawItems?.find(i => i.id === ci.linkedErpItemId);
                                        const contractor = contractors?.find(c => c.id === ci.contractorId);
                                        return (
                                            <TableRow key={ci.id} className="hover:bg-indigo-50/30 border-none border-b border-slate-50 last:border-none group">
                                                <TableCell className="pl-12 py-6">
                                                    <div className="flex items-center gap-3">
                                                        {ci.isPreferred && <Star className="h-4 w-4 text-amber-400 fill-amber-400 flex-shrink-0" />}
                                                        <span className="font-black uppercase text-[15px] tracking-tight">{erpItem?.name || '—'}</span>
                                                    </div>
                                                    <span className="text-[9px] text-muted-foreground/40 font-bold uppercase ml-7">{erpItem?.baseUnit}</span>
                                                </TableCell>
                                                <TableCell>
                                                    <span className="font-bold text-slate-600">{ci.supplierName || '—'}</span>
                                                    <div className="text-[9px] text-muted-foreground/40 uppercase font-bold">{ci.unit}</div>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge className="bg-indigo-50 text-indigo-600 border-none font-black text-[10px] uppercase rounded-xl px-3">
                                                        {contractor?.name || '—'}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <span className="font-black text-primary text-lg">{(ci.pricePerUnit||0).toLocaleString()}</span>
                                                    <span className="text-[10px] text-muted-foreground ml-1">сум/{ci.unit}</span>
                                                </TableCell>
                                                <TableCell>
                                                    <Button 
                                                        variant="ghost" size="icon"
                                                        className="opacity-0 group-hover:opacity-100 transition-all rounded-xl hover:bg-rose-50 hover:text-rose-500"
                                                        onClick={() => firestore && orgId && deleteDoc(doc(firestore, 'organizations', orgId, 'contractor_items', ci.id))}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })
                                }
                                {(contractorItems||[]).length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center py-24">
                                            <div className="space-y-4">
                                                <Package className="h-16 w-16 text-muted-foreground/10 mx-auto" />
                                                <p className="text-sm font-black uppercase text-muted-foreground/30 tracking-widest">Нет привязанных ингредиентов</p>
                                                <p className="text-xs text-muted-foreground/20">Нажмите «Привязать Ингредиент» чтобы начать</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}

// ============================================
// ДИАЛОГ ПРИВЯЗКИ ИНГРЕДИЕНТА К ПОСТАВЩИКУ
// ============================================
function LinkIngredientDialog({ contractors, erpItems, firestore, orgId }: { contractors: Contractor[], erpItems: ERPItem[], firestore: any, orgId: string | null }) {
    const { toast } = useToast();
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [form, setForm] = useState({
        contractorId: '',
        linkedErpItemId: '',
        supplierName: '',
        pricePerUnit: '',
        unit: 'кг',
        isPreferred: false
    });

    async function handleSave() {
        if (!firestore || !form.contractorId || !form.linkedErpItemId || !orgId) {
            toast({ variant: 'destructive', title: 'Выберите поставщика и ингредиент' });
            return;
        }
        setLoading(true);
        try {
            await addDoc(collection(firestore, 'organizations', orgId, 'contractor_items'), {
                ...form,
                pricePerUnit: Number(form.pricePerUnit) || 0,
                updatedAt: serverTimestamp()
            });
            toast({ title: '✓ Ингредиент привязан к поставщику' });
            setForm({ contractorId: '', linkedErpItemId: '', supplierName: '', pricePerUnit: '', unit: 'кг', isPreferred: false });
            setOpen(false);
        } catch (e) {
            toast({ variant: 'destructive', title: 'Ошибка сохранения' });
        } finally {
            setLoading(false);
        }
    }

    function handleErpSelect(erpId: string) {
        const item = erpItems.find(i => i.id === erpId);
        setForm(f => ({
            ...f,
            linkedErpItemId: erpId,
            supplierName: item?.name || '',
            unit: item?.baseUnit || 'кг'
        }));
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="h-12 px-8 rounded-2xl bg-indigo-600 hover:bg-black font-black uppercase text-[11px] tracking-widest shadow-xl flex-shrink-0">
                    <Plus className="w-4 h-4 mr-2" /> Привязать Ингредиент
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[520px] rounded-[3.5rem] p-12 border-none shadow-2xl bg-white overflow-y-auto max-h-[95vh] scrollbar-hide">
                <DialogHeader>
                    <DialogTitle className="text-2xl font-black uppercase tracking-tighter flex items-center gap-3">
                        <div className="p-3 bg-indigo-50 rounded-[1.5rem]"><LinkIcon className="w-6 h-6 text-indigo-600" /></div>
                        <div>
                            <div>Привязка Ингредиента</div>
                            <div className="text-[10px] text-indigo-400 -mt-0.5 font-black uppercase tracking-[0.2em]">Smart Order Routing</div>
                        </div>
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-6 pt-8">
                    <div className="space-y-2">
                        <Label className="text-[11px] uppercase font-black text-indigo-600 tracking-widest ml-1">Поставщик (из Банки и Счета)</Label>
                        <SearchableSelect 
                            options={contractors.map(c => ({ value: c.id, label: c.name }))} 
                            value={form.contractorId} 
                            onChange={v => setForm(f => ({...f, contractorId: v}))} 
                            placeholder="Выберите контрагента..."
                        />
                    </div>

                    <div className="space-y-2">
                        <Label className="text-[11px] uppercase font-black text-emerald-600 tracking-widest ml-1">Наш Ингредиент (FLOW / Poster)</Label>
                        <SearchableSelect 
                            options={erpItems.map(i => ({ value: i.id, label: i.name }))} 
                            value={form.linkedErpItemId} 
                            onChange={handleErpSelect} 
                            placeholder="Начните вводить название..."
                        />
                    </div>

                    <div className="p-6 bg-slate-50 rounded-[2rem] space-y-4 border-2 border-white">
                        <Label className="text-[10px] uppercase font-black text-slate-400 tracking-widest">У Поставщика этот товар называется:</Label>
                        <Input 
                            value={form.supplierName} 
                            onChange={e => setForm(f => ({...f, supplierName: e.target.value}))} 
                            placeholder="Как записано в накладной поставщика..."
                            className="h-12 rounded-xl bg-white border-2 border-slate-100 font-bold"
                        />

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-[9px] uppercase font-black text-slate-400 ml-1">Цена за ед.</Label>
                                <Input 
                                    type="number" 
                                    value={form.pricePerUnit} 
                                    onChange={e => setForm(f => ({...f, pricePerUnit: e.target.value}))} 
                                    placeholder="0"
                                    className="h-12 rounded-xl bg-white border-2 border-slate-100 font-black"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[9px] uppercase font-black text-slate-400 ml-1">Единица</Label>
                                <Input 
                                    value={form.unit} 
                                    onChange={e => setForm(f => ({...f, unit: e.target.value}))} 
                                    className="h-12 rounded-xl bg-white border-2 border-slate-100 font-black"
                                />
                            </div>
                        </div>

                        <label className="flex items-center gap-3 cursor-pointer p-4 bg-amber-50 rounded-2xl border-2 border-amber-100 hover:border-amber-200 transition-all">
                            <input 
                                type="checkbox" 
                                checked={form.isPreferred} 
                                onChange={e => setForm(f => ({...f, isPreferred: e.target.checked}))}
                                className="w-5 h-5 rounded-lg accent-amber-500"
                            />
                            <div>
                                <p className="text-[11px] font-black uppercase text-amber-700 tracking-widest">⭐ Основной поставщик</p>
                                <p className="text-[9px] text-amber-500 font-medium">Будет выбираться автоматически при заказе</p>
                            </div>
                        </label>
                    </div>
                </div>

                <DialogFooter className="pt-8">
                    <Button 
                        onClick={handleSave} 
                        disabled={loading || !form.contractorId || !form.linkedErpItemId}
                        className="w-full h-16 rounded-[2rem] bg-indigo-600 hover:bg-black font-black uppercase text-[12px] tracking-widest shadow-xl transition-all"
                    >
                        {loading ? <RefreshCw className="h-5 w-5 animate-spin" /> : <><LinkIcon className="h-5 w-5 mr-2" /> Зафиксировать Связку</>}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
