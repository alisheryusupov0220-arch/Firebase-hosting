'use client';

import React, { useState, useMemo } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogTrigger
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useCollection, useFirestore } from '@/firebase/hooks';
import { useMemoFirebase, useFirebase } from '@/firebase/provider';
import { collection, query, orderBy, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { ERPItem, ABCGroup } from '@/lib/types/erp';
import { 
    Clock, 
    TrendingUp, 
    ShieldAlert, 
    Search,
    RefreshCw,
    CheckCircle2,
    CalendarDays,
    Settings2,
    X,
    LayoutGrid,
    MousePointerClick,
    Plus,
    Layers,
    AlertCircle,
    ArrowRight,
    HelpCircle,
    Trash2,
    Save
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import Link from 'next/link';

const DAYS = [
    { id: 1, label: 'Понедельник', short: 'Пн' },
    { id: 2, label: 'Вторник', short: 'Вт' },
    { id: 3, label: 'Среда', short: 'Ср' },
    { id: 4, label: 'Четверг', short: 'Чт' },
    { id: 5, label: 'Пятница', short: 'Пт' },
    { id: 6, label: 'Суббота', short: 'Сб' },
    { id: 0, label: 'Воскресенье', short: 'Вс' },
];

export default function IngredientSchedulePage() {
    const firestore = useFirestore();
    const { orgId } = useFirebase();
    const { toast } = useToast();
    const [searchTerm, setSearchTerm] = useState('');
    const [calendarSearch, setCalendarSearch] = useState('');
    const [editingItem, setEditingItem] = useState<ERPItem | null>(null);
    const [isPending, setIsPending] = useState(false);

    const itemsQuery = useMemoFirebase(() => {
        if (!firestore || !orgId) return null;
        return query(collection(firestore, 'organizations', orgId, 'erp_items'), orderBy('name', 'asc'));
    }, [firestore, orgId]);
    const { data: items } = useCollection<ERPItem>(itemsQuery);

    const categoriesQuery = useMemoFirebase(() => {
        if (!firestore || !orgId) return null;
        return query(collection(firestore, 'organizations', orgId, 'categories'), orderBy('order', 'asc'));
    }, [firestore, orgId]);
    const { data: categories } = useCollection<any>(categoriesQuery);

    const updateItemSchedule = async (itemId: string, updates: any) => {
        if (!firestore || !orgId || isPending) return;
        setIsPending(true);
        try {
            // Function to recursively remove undefined values which Firestore doesn't like
            const cleanData = (obj: any): any => {
                const result: any = {};
                Object.keys(obj).forEach(key => {
                    if (obj[key] === undefined) return;
                    if (obj[key] === null) {
                        result[key] = null;
                        return;
                    }
                    if (typeof obj[key] === 'object' && !Array.isArray(obj[key]) && !(obj[key] instanceof Date)) {
                        result[key] = cleanData(obj[key]);
                    } else {
                        result[key] = obj[key];
                    }
                });
                return result;
            };

            const dataToUpdate = { 
                ...cleanData(updates), 
                updatedAt: serverTimestamp() 
            };

            await updateDoc(doc(firestore, 'organizations', orgId, 'erp_items', itemId), dataToUpdate);
            toast({ title: 'Обновлено' });
            setEditingItem(null);
        } catch (e: any) { 
            console.error('Firestore Update Error:', e);
            toast({ 
                title: 'Ошибка сохранения', 
                description: e.message || 'Проверьте соединение или права доступа', 
                variant: 'destructive' 
            }); 
        }
        finally { setIsPending(false); }
    };

    const toggleDayInEdit = (dayId: number) => {
        if (!editingItem) return;
        const currentDays = editingItem.orderSchedule?.daysOfWeek || [];
        const newDays = currentDays.includes(dayId) ? currentDays.filter(d => d !== dayId) : [...currentDays, dayId];
        setEditingItem({ ...editingItem, orderSchedule: { ...editingItem.orderSchedule, daysOfWeek: newDays, weeksInterval: editingItem.orderSchedule?.weeksInterval || 1 } } as any);
    };

    // Grouping Logics
    const unconfiguredABCGrouped = useMemo(() => {
        if (!items || !categories) return [];
        const filtered = items.filter(i => !i.abcGroup && i.name.toLowerCase().includes(searchTerm.toLowerCase()));
        const groups: Record<string, any[]> = {};
        filtered.forEach(i => { const catId = String(i.categoryId || 'none'); if (!groups[catId]) groups[catId] = []; groups[catId].push(i); });
        return categories.map((cat: any) => groups[cat.id] ? { id: cat.id, name: cat.name, items: groups[cat.id] } : null).filter(Boolean).concat(groups['none'] ? [{id: 'none', name: 'Прочее', items: groups['none']}] : []) as any[];
    }, [items, categories, searchTerm]);

    const abcMetadata = {
        'A': { label: 'КРИТИЧЕСКИ ВАЖНЫЕ', color: 'rose', icon: ShieldAlert },
        'B': { label: 'СРЕДНЯЯ ВАЖНОСТЬ', color: 'indigo', icon: TrendingUp },
        'C': { label: 'МАЛОЦЕННЫЕ', color: 'slate', icon: Clock }
    };

    const dailyChecklist = useMemo(() => {
        if (!items || !categories) return {};
        const results: Record<number, any[]> = {};
        DAYS.forEach(day => {
            const dayItems = items.filter(i => 
                i.orderSchedule?.daysOfWeek?.includes(day.id) && 
                i.name.toLowerCase().includes(calendarSearch.toLowerCase())
            );
            const groups: Record<string, any[]> = {};
            dayItems.forEach(item => { const catId = String(item.categoryId || 'none'); if (!groups[catId]) groups[catId] = []; groups[catId].push(item); });
            results[day.id] = categories.map((cat: any) => groups[cat.id] ? { id: cat.id, name: cat.name, items: groups[cat.id].sort((a, b) => (a.abcGroup || 'Z').localeCompare(b.abcGroup || 'Z')) } : null).filter(Boolean).concat(groups['none'] ? [{id: 'none', name: 'Прочее', items: groups['none']}] : []) as any[];
        });
        return results;
    }, [items, categories, calendarSearch]);

    const pendingScheduleGrouped = useMemo(() => {
        if (!items || !categories) return [];
        const pending = items.filter(i => i.abcGroup && (!i.orderSchedule?.daysOfWeek || i.orderSchedule.daysOfWeek.length === 0));
        const groups: Record<string, any[]> = {};
        
        pending.forEach(i => { 
            const catId = String(i.categoryId || 'none'); 
            if (!groups[catId]) groups[catId] = []; 
            groups[catId].push(i); 
        });

        // Sort by ABC within each group
        Object.keys(groups).forEach(key => {
            groups[key].sort((a, b) => (a.abcGroup || 'Z').localeCompare(b.abcGroup || 'Z'));
        });

        return categories.map((cat: any) => groups[cat.id] ? { id: cat.id, name: cat.name, items: groups[cat.id] } : null).filter(Boolean).concat(groups['none'] ? [{id: 'none', name: 'Прочее', items: groups['none']}] : []) as any[];
    }, [items, categories]);

    return (
        <div className="space-y-4 pb-40 px-2 sm:px-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b pb-4">
                <PageHeader title="Матрица" description="ABC и график." />
                <Button asChild variant="outline" size="sm" className="rounded-xl h-8 text-[10px] font-black uppercase" disabled={isPending}>
                    <Link href="/orders"><RefreshCw className={cn("h-3 w-3 mr-2", isPending && "animate-spin")} /> Заказы</Link>
                </Button>
            </div>

            <Tabs defaultValue="abc" className="space-y-4">
                <TabsList className="bg-muted p-1 rounded-xl h-10 w-fit border shadow-inner">
                    <TabsTrigger value="abc" className="px-6 rounded-lg h-8 data-[state=active]:bg-background font-black uppercase text-[9px] tracking-widest">ABC Анализ</TabsTrigger>
                    <TabsTrigger value="calendar" className="px-6 rounded-lg h-8 data-[state=active]:bg-background font-black uppercase text-[9px] tracking-widest">График Поставок</TabsTrigger>
                </TabsList>

                {/* TAB 1: ABC CONFIG */}
                <TabsContent value="abc" className="space-y-8 animate-in fade-in duration-300">
                    {/* UNCONFIGURED SECTION */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between px-1">
                            <h3 className="font-black uppercase text-[9px] tracking-widest text-foreground flex items-center gap-2">
                                <HelpCircle className="h-3 w-3 text-amber-500" /> НОВЫЕ ТОВАРЫ
                                <Badge variant="secondary" className="h-4 text-[8px] bg-amber-500/10 text-amber-600 border-none px-1.5">{items?.filter(i => !i.abcGroup).length}</Badge>
                            </h3>
                            <div className="relative w-48">
                                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                                <Input placeholder="Поиск..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-7 h-8 text-[10px] rounded-lg bg-card border-none shadow-sm" />
                            </div>
                        </div>

                        <div className="space-y-4 pl-2 border-l-2 border-amber-500/20">
                            {unconfiguredABCGrouped.map(cat => (
                                <div key={cat.id} className="space-y-1.5">
                                    <h4 className="text-[8px] font-black uppercase tracking-tight text-muted-foreground ml-1 opacity-60">{cat.name}</h4>
                                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-1.5">
                                        {cat.items.map((item: ERPItem) => (
                                            <div key={item.id} className="p-1.5 bg-card rounded-lg border border-border/40 flex items-center justify-between group hover:border-amber-400 transition-all">
                                                <div className="min-w-0 flex-1 pr-1 cursor-pointer" onClick={() => setEditingItem(item)}>
                                                    <p className="font-black text-[9px] truncate uppercase leading-tight group-hover:text-amber-500 transition-colors">{item.name}</p>
                                                </div>
                                                <div className="flex gap-0.5">
                                                    {['A', 'B', 'C'].map(g => (
                                                        <Button 
                                                            key={g} size="icon" variant="outline" 
                                                            disabled={isPending}
                                                            className={cn("h-5 w-5 rounded-md font-black text-[8px]", 
                                                                g === 'A' ? "text-rose-500 hover:bg-rose-500 hover:text-white" :
                                                                g === 'B' ? "text-indigo-500 hover:bg-indigo-500 hover:text-white" :
                                                                "text-slate-500 hover:bg-slate-500 hover:text-white"
                                                            )}
                                                            onClick={() => updateItemSchedule(item.id, { abcGroup: g as ABCGroup })}
                                                        >
                                                            {g}
                                                        </Button>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* CONFIGURED LEVELS */}
                    <div className="space-y-8">
                        {(Object.keys(abcMetadata) as Array<keyof typeof abcMetadata>).map(abcKey => {
                            const levelItems = (items || []).filter(i => i.abcGroup === abcKey);
                            const meta = abcMetadata[abcKey];
                            if (levelItems.length === 0) return null;

                            return (
                                <div key={abcKey} className="space-y-2">
                                    <div className="flex items-center gap-2 px-1">
                                        <div className={cn("w-6 h-6 rounded-lg flex items-center justify-center text-white shadow-sm", 
                                            abcKey === 'A' ? "bg-rose-500" : abcKey === 'B' ? "bg-indigo-500" : "bg-slate-500"
                                        )}>
                                            <meta.icon className="h-3 w-3" />
                                        </div>
                                        <h3 className={cn("text-[10px] font-black uppercase tracking-widest", abcKey === 'A' ? "text-rose-600" : abcKey === 'B' ? "text-indigo-600" : "text-slate-600")}>
                                            {meta.label} ({levelItems.length})
                                        </h3>
                                    </div>

                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-7 xl:grid-cols-9 gap-1.5 pl-2 border-l-2 border-dashed border-muted/30 ml-4">
                                        {levelItems.map(item => (
                                            <div key={item.id} className="group relative bg-card h-8 rounded-lg border border-border/40 p-2 pr-6 flex items-center hover:border-primary/50 transition-all cursor-default">
                                                <div className={cn("absolute left-0 top-0 bottom-0 w-1 rounded-l-lg", 
                                                    abcKey === 'A' ? "bg-rose-500" : abcKey === 'B' ? "bg-indigo-500" : "bg-slate-500"
                                                )} />
                                                <span className="font-black text-[9px] truncate flex-1 uppercase">{item.name}</span>
                                                <Button size="icon" variant="ghost" className="h-5 w-5 absolute right-0.5 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-rose-500" onClick={() => updateItemSchedule(item.id, { abcGroup: null })} disabled={isPending}>
                                                    <X className="h-2 w-2" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </TabsContent>

                {/* TAB 2: CALENDAR MATRIX */}
                <TabsContent value="calendar" className="space-y-6 animate-in slide-in-from-bottom-5 duration-300">
                    <div className="flex items-center justify-between px-1">
                        <div className="flex items-center gap-4">
                            <h3 className="font-black uppercase text-[10px] tracking-widest text-foreground flex items-center gap-2">
                                <CalendarDays className="h-4 w-4 text-primary" /> ГРАФИК ПО ДНЯМ
                            </h3>
                            <div className="relative w-64">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input 
                                    placeholder="Поиск ингредиента в графике..." 
                                    value={calendarSearch} 
                                    onChange={(e) => setCalendarSearch(e.target.value)} 
                                    className="pl-10 h-10 text-[11px] rounded-xl bg-card border-none shadow-sm font-bold" 
                                />
                            </div>
                        </div>
                        <Badge variant="outline" className="h-6 rounded-lg text-[9px] font-black uppercase text-slate-400 border-slate-200">
                            Всего в графике: {items?.filter(i => i.orderSchedule?.daysOfWeek?.length).length}
                        </Badge>
                    </div>

                    <div className="flex flex-col lg:flex-row overflow-x-auto gap-2 pb-2 scrollbar-hide">
                        {DAYS.map(day => {
                            const dayGroups = dailyChecklist[day.id] || [];
                            return (
                                <div key={day.id} className="min-w-[280px] lg:flex-1 space-y-2">
                                    <div className="flex items-center justify-between bg-muted/40 px-3 py-1.5 rounded-xl border">
                                        <h4 className="font-black text-[9px] uppercase tracking-widest text-slate-500">
                                            {day.label}
                                        </h4>
                                        <Dialog>
                                            <DialogTrigger asChild>
                                                <Button size="icon" variant="ghost" className="h-5 w-5 rounded-md hover:bg-primary/10 hover:text-primary">
                                                    <Plus className="h-3 w-3" />
                                                </Button>
                                            </DialogTrigger>
                                            <DialogContent className="sm:max-w-[400px] rounded-[2rem] p-6 shadow-2xl border-none">
                                                <DialogHeader>
                                                    <DialogTitle className="text-lg font-black uppercase tracking-tighter">Добавить на {day.label}</DialogTitle>
                                                    <DialogDescription className="text-[9px] font-bold uppercase tracking-widest">Выберите ингредиент для графика</DialogDescription>
                                                </DialogHeader>
                                                <div className="py-4 space-y-4">
                                                    <div className="relative">
                                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                                        <Input 
                                                            placeholder="Поиск по базе..." 
                                                            className="pl-10 h-10 rounded-xl"
                                                            onChange={(e) => setSearchTerm(e.target.value)}
                                                        />
                                                    </div>
                                                    <div className="max-h-[300px] overflow-y-auto space-y-1 pr-2 scrollbar-hide">
                                                        {items?.filter(i => i.name.toLowerCase().includes(searchTerm.toLowerCase())).slice(0, 20).map(item => (
                                                            <div 
                                                                key={item.id} 
                                                                className="p-3 bg-slate-50 hover:bg-primary/5 rounded-xl cursor-pointer transition-all border border-transparent hover:border-primary/20 flex justify-between items-center"
                                                                onClick={() => {
                                                                    const currentDays = item.orderSchedule?.daysOfWeek || [];
                                                                    if (!currentDays.includes(day.id)) {
                                                                        updateItemSchedule(item.id, { 
                                                                            abcGroup: item.abcGroup || 'C', // Default if missing
                                                                            orderSchedule: { 
                                                                                ...item.orderSchedule, 
                                                                                daysOfWeek: [...currentDays, day.id],
                                                                                weeksInterval: item.orderSchedule?.weeksInterval || 1
                                                                            } 
                                                                        });
                                                                    }
                                                                }}
                                                            >
                                                                <span className="font-black text-[10px] uppercase truncate">{item.name}</span>
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-[8px] font-black opacity-30">{item.abcGroup || 'NEW'}</span>
                                                                    <Plus className="h-3 w-3 text-primary" />
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </DialogContent>
                                        </Dialog>
                                    </div>
                                    <div className="bg-muted/5 rounded-[1.5rem] border border-dashed border-border p-2 min-h-[500px] space-y-4">
                                        {dayGroups.map(group => (
                                            <div key={group.id} className="space-y-1.5">
                                                <h5 className="font-black uppercase text-[8px] tracking-[0.15em] text-muted-foreground/60 ml-2">{group.name}</h5>
                                                <div className="space-y-1">
                                                    {group.items.map((item: ERPItem) => (
                                                        <div 
                                                            key={item.id} onClick={() => setEditingItem(item)}
                                                            className={cn(
                                                                "group relative bg-card p-2 rounded-xl border border-border/40 shadow-sm transition-all cursor-pointer hover:border-primary/50",
                                                                item.abcGroup === 'A' ? "border-l-4 border-l-rose-500" : item.abcGroup === 'B' ? "border-l-4 border-l-indigo-500" : "border-l-4 border-l-slate-400"
                                                            )}
                                                        >
                                                            <p className="font-black text-[10px] leading-tight truncate uppercase mb-0.5">{item.name}</p>
                                                            <div className="flex items-center justify-between">
                                                                <div className="flex items-center gap-1 opacity-40"><Clock className="h-2 w-2" /><span className="text-[8px] font-black">{item.supplierLeadTime || 1}д</span></div>
                                                                <span className="text-[8px] font-black text-muted-foreground/40">{item.abcGroup}</span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* PENDING LIST BELOW */}
                    <div className="pt-10 border-t border-dashed space-y-4">
                        <h3 className="font-black uppercase text-[10px] tracking-widest text-indigo-500 flex items-center gap-2 ml-1">
                            <AlertCircle className="h-3 w-3" /> ОЖИДАЮТ ГРАФИКА
                            <Badge className="bg-indigo-500 text-white font-black text-[8px] h-3.5 px-1.5 rounded-full">{pendingScheduleGrouped.reduce((acc, g) => acc + g.items.length, 0)}</Badge>
                        </h3>

                        <div className="space-y-6">
                            {pendingScheduleGrouped.map(cat => (
                                <div key={cat.id} className="space-y-1.5">
                                    <h4 className="font-black uppercase text-[8px] tracking-widest text-muted-foreground ml-3">{cat.name}</h4>
                                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 xxl:grid-cols-10 gap-1.5 px-4">
                                        {cat.items.map((item: ERPItem) => (
                                            <div 
                                                key={item.id} onClick={() => setEditingItem(item)}
                                                className={cn(
                                                    "px-3 py-2 bg-white rounded-lg border border-slate-200 shadow-sm cursor-pointer hover:border-indigo-500 transition-all flex items-center gap-3 relative overflow-hidden group h-9",
                                                )}
                                            >
                                                <div className={cn("absolute left-0 top-0 bottom-0 w-1", 
                                                    item.abcGroup === 'A' ? "bg-rose-500" : item.abcGroup === 'B' ? "bg-indigo-500" : "bg-slate-300"
                                                )} />
                                                <p className="font-black text-[9px] uppercase truncate flex-1 leading-none">{item.name}</p>
                                                <span className={cn("text-[7px] font-black uppercase opacity-40 px-1 rounded", 
                                                     item.abcGroup === 'A' ? "text-rose-600 bg-rose-50" : item.abcGroup === 'B' ? "text-indigo-600 bg-indigo-50" : ""
                                                )}>{item.abcGroup}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </TabsContent>
            </Tabs>

            {/* EDIT DIALOG */}
            <Dialog open={!!editingItem} onOpenChange={(open) => !open && setEditingItem(null)}>
                <DialogContent className="sm:max-w-[400px] rounded-[2rem] p-0 overflow-hidden border-none shadow-2xl">
                    {editingItem && (
                        <div className="bg-card">
                            <div className={cn("h-2 w-full", editingItem.abcGroup === 'A' ? "bg-rose-500" : editingItem.abcGroup === 'B' ? "bg-indigo-500" : "bg-slate-400")} />
                            <div className="p-6 space-y-6">
                                <div className="flex justify-between items-start gap-4">
                                    <DialogHeader className="text-left flex-1 min-w-0">
                                        <DialogTitle className="text-xl font-black truncate uppercase tracking-tighter">{editingItem.name}</DialogTitle>
                                        <DialogDescription className="font-bold uppercase text-[9px] text-muted-foreground tracking-widest">Профиль логистики и данных</DialogDescription>
                                    </DialogHeader>
                                    <Button variant="outline" size="icon" className="h-10 w-10 text-rose-500 border-none bg-rose-50 hover:bg-rose-100 rounded-xl" onClick={() => updateItemSchedule(editingItem.id, { abcGroup: null, orderSchedule: null })} disabled={isPending}>
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>

                                <div className="space-y-4 pt-2">
                                    <div className="grid gap-2">
                                        <Label className="text-[9px] uppercase font-black text-slate-400">Название в FLOW (Альянс)</Label>
                                        <Input value={editingItem.name} onChange={(e) => setEditingItem({...editingItem, name: e.target.value})} className="h-10 rounded-xl font-bold bg-muted/20 border-none shadow-inner" disabled={isPending} />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="grid gap-2">
                                            <Label className="text-[9px] uppercase font-black text-slate-400">Категория</Label>
                                            <select 
                                                value={editingItem.categoryId || ''} 
                                                onChange={(e) => setEditingItem({...editingItem, categoryId: e.target.value, categoryName: categories?.find(c => c.id === e.target.value)?.name || 'Прочее'})}
                                                className="h-10 rounded-xl font-black text-[10px] uppercase bg-muted/20 border-none shadow-inner px-3 outline-none"
                                                disabled={isPending}
                                            >
                                                {categories?.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                                            </select>
                                        </div>
                                        <div className="grid gap-2">
                                            <Label className="text-[9px] uppercase font-black text-slate-400">ABC Группа</Label>
                                            <div className="flex gap-1 h-10">
                                                {['A', 'B', 'C'].map(g => (
                                                    <Button 
                                                        key={g} type="button" size="sm" 
                                                        variant={editingItem.abcGroup === g ? "default" : "outline"}
                                                        className={cn("flex-1 rounded-xl font-black text-[10px]", 
                                                            editingItem.abcGroup === g ? (
                                                                g === 'A' ? "bg-rose-500 hover:bg-rose-600" :
                                                                g === 'B' ? "bg-indigo-500 hover:bg-indigo-600" :
                                                                "bg-slate-500 hover:bg-slate-600"
                                                            ) : "border-slate-200"
                                                        )}
                                                        onClick={() => setEditingItem({...editingItem, abcGroup: g as any})}
                                                        disabled={isPending}
                                                    >
                                                        {g}
                                                    </Button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="grid gap-2">
                                        <Label className="text-[9px] uppercase font-black text-slate-400">Ед. измерения</Label>
                                        <Input value={editingItem.baseUnit || ''} onChange={(e) => setEditingItem({...editingItem, baseUnit: e.target.value as any})} className="h-10 rounded-xl font-black uppercase bg-muted/20 border-none shadow-inner" disabled={isPending} />
                                    </div>
                                </div>

                                <div className="h-px bg-slate-100" />

                                <div className="space-y-3">
                                    <Label className="text-[9px] uppercase font-black text-primary flex justify-between">Дни недели <span className="text-[8px] opacity-40">Когда заказывать</span></Label>
                                    <div className="grid grid-cols-7 gap-1">
                                        {DAYS.map(day => {
                                            const active = editingItem.orderSchedule?.daysOfWeek?.includes(day.id);
                                            return <Button key={day.id} type="button" size="sm" variant={active ? "default" : "outline"} className={cn("h-7 p-0 rounded-lg font-black text-[9px] uppercase", active ? "bg-primary text-white" : "border-slate-200")} onClick={() => toggleDayInEdit(day.id)} disabled={isPending}>{day.short}</Button>
                                        })}
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-3">
                                        <Label className="text-[9px] uppercase font-black text-primary">Интервал (нед)</Label>
                                        <div className="flex items-center gap-2 bg-muted/10 p-2 rounded-xl h-10 border border-slate-100">
                                            <input type="range" min="1" max="4" value={editingItem.orderSchedule?.weeksInterval || 1} onChange={(e) => setEditingItem({...editingItem, orderSchedule: {...editingItem.orderSchedule, weeksInterval: Number(e.target.value)}} as any)} className="flex-1 accent-primary" disabled={isPending} />
                                            <span className="font-black text-primary text-xs w-3">{editingItem.orderSchedule?.weeksInterval || 1}</span>
                                        </div>
                                    </div>
                                    <div className="space-y-3">
                                        <Label className="text-[9px] uppercase font-black text-primary text-right">Доставка (дн)</Label>
                                        <Input type="number" value={editingItem.supplierLeadTime || 1} onChange={(e) => setEditingItem({...editingItem, supplierLeadTime: Number(e.target.value)})} className="h-10 rounded-xl font-black text-center text-sm bg-muted/30 border-none shadow-inner" disabled={isPending} />
                                    </div>
                                </div>
                                <DialogFooter className="gap-2 pt-4">
                                    <Button variant="ghost" className="flex-1 h-12 rounded-xl font-black uppercase text-[10px] text-slate-400" onClick={() => setEditingItem(null)} disabled={isPending}>Отмена</Button>
                                    <Button className="flex-1 h-12 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-primary/20" onClick={() => updateItemSchedule(editingItem.id, {  name: editingItem.name, abcGroup: editingItem.abcGroup, baseUnit: editingItem.baseUnit, categoryId: editingItem.categoryId, categoryName: editingItem.categoryName, orderSchedule: editingItem.orderSchedule,  supplierLeadTime: editingItem.supplierLeadTime || 1  })} disabled={isPending}>
                                        {isPending ? <RefreshCw className="animate-spin h-5 w-5" /> : (
                                            <div className="flex items-center"><Save className="mr-2 h-4 w-4" /> Сохранить</div>
                                        )}
                                    </Button>
                                </DialogFooter>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
