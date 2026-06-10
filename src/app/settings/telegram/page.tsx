'use client';

import React, { useState, useTransition } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useCollection, useFirestore } from '@/firebase/hooks';
import { useMemoFirebase, useFirebase } from '@/firebase/provider';
import { collection, query, orderBy, addDoc, serverTimestamp, deleteDoc, doc, updateDoc, where } from 'firebase/firestore';
import { Bot, Users, Trash2, Plus, CheckCircle2, AlertCircle, Terminal, RefreshCw, Link as LinkIcon, History, MessageSquare, Image as ImageIcon, MousePointer2, Truck, Zap, Landmark, Settings2, Pencil, Building2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { 
    Dialog, 
    DialogContent, 
    DialogHeader, 
    DialogTitle, 
    DialogTrigger,
    DialogFooter
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { setWebhookAction, getBotInfoAction, clearTelegramLogsAction, testTelegramGroupAction } from './actions';
import { cn } from '@/lib/utils';

export default function TelegramSettingsPage() {
    const { toast } = useToast();
    const { orgId } = useFirebase();
    const firestore = useFirestore();
    const [isPending, startTransition] = useTransition();
    const [newGroupId, setNewGroupId] = useState('');
    const [newGroupName, setNewGroupName] = useState('');
    const [newGroupType, setNewGroupType] = useState<'PROCUREMENT' | 'FINANCE'>('FINANCE');
    const [selectedCompanyId, setSelectedCompanyId] = useState('');
    const [selectedAccountId, setSelectedAccountId] = useState('');
    const [webhookUrl, setWebhookUrl] = useState('');
    const [botInfo, setBotInfo] = useState<any>(null);
    const [isChecking, setIsChecking] = useState(false);

    const groupsQuery = useMemoFirebase(() => {
        if (!firestore || !orgId) return null;
        return query(collection(firestore, 'telegram_groups'), where('orgId', '==', orgId));
    }, [firestore, orgId]);
    
    const logsQuery = useMemoFirebase(() => 
        firestore ? query(collection(firestore, 'telegram_logs'), orderBy('createdAt', 'desc')) : null
    , [firestore]);

    const companiesQuery = useMemoFirebase(() => {
        if (!firestore || !orgId) return null;
        return query(collection(firestore, 'organizations', orgId, 'my_companies'), orderBy('brandName', 'asc'));
    }, [firestore, orgId]);

    const accountsQuery = useMemoFirebase(() => {
        if (!firestore || !orgId) return null;
        return query(collection(firestore, 'organizations', orgId, 'bank_accounts'), orderBy('bankName', 'asc'));
    }, [firestore, orgId]);
    
    const { data: groupsData } = useCollection<any>(groupsQuery);
    const { data: logs } = useCollection<any>(logsQuery);
    const { data: companiesData } = useCollection<any>(companiesQuery);
    const { data: accountsData } = useCollection<any>(accountsQuery);

    const companies = companiesData || [];
    const accounts = accountsData || [];

    const groupsList = React.useMemo(() => {
        if (!groupsData) return [];
        return [...groupsData].sort((a, b) => {
            const dateA = a.createdAt?.seconds || 0;
            const dateB = b.createdAt?.seconds || 0;
            return dateB - dateA;
        });
    }, [groupsData]);

    const filteredAccountsForNewGroup = React.useMemo(() => {
        if (!selectedCompanyId) return [];
        return accounts.filter(acc => acc.companyId === selectedCompanyId);
    }, [accounts, selectedCompanyId]);

    const handleAddGroup = async () => {
        if (!firestore || !newGroupId || !orgId) return;
        try {
            await addDoc(collection(firestore, 'telegram_groups'), {
                orgId,
                chatId: newGroupId,
                name: newGroupName || 'Новая группа',
                type: newGroupType,
                isActive: true,
                topics: {},
                defaultCompanyId: selectedCompanyId || null,
                defaultAccountId: selectedAccountId || null,
                createdAt: serverTimestamp()
            });
            setNewGroupId('');
            setNewGroupName('');
            setSelectedCompanyId('');
            setSelectedAccountId('');
            toast({ title: 'Группа добавлена' });
        } catch (e) {
            toast({ variant: 'destructive', title: 'Ошибка добавления' });
        }
    };

    const toggleGroup = async (id: string, current: boolean) => {
        if (!firestore) return;
        await updateDoc(doc(firestore, 'telegram_groups', id), {
            isActive: !current
        });
    };

    const deleteGroup = async (id: string) => {
        if (!firestore || !confirm('Удалить группу из реестра?')) return;
        await deleteDoc(doc(firestore, 'telegram_groups', id));
        toast({ title: 'Группа удалена' });
    };

    const handleSetWebhook = async () => {
        if (!webhookUrl) return;
        const res = await setWebhookAction(webhookUrl);
        if (res.ok) {
            toast({ title: 'Webhook установлен!', description: 'Теперь бот видит сообщения' });
        } else {
            toast({ variant: 'destructive', title: 'Ошибка Webhook', description: String(res.error) });
        }
    };

    const handleCheckBot = async () => {
        setIsChecking(true);
        const res = await getBotInfoAction();
        setBotInfo(res);
        setIsChecking(false);
    };

    const handleClearLogs = async () => {
        if (!confirm('Очистить всю историю событий?')) return;
        await clearTelegramLogsAction();
        toast({ title: 'История очищена' });
    };

    return (
        <div className="space-y-8 p-6 max-w-5xl mx-auto pb-32">
            <PageHeader 
                title="Настройки Telegram" 
                description="Управление специализацией групп и маршрутизацией топиков."
            />

            <div className="grid gap-8">
                {/* ДОБАВЛЕНИЕ ГРУППЫ */}
                <Card className="rounded-[2.5rem] border-none shadow-2xl overflow-hidden">
                    <CardHeader className="bg-slate-50 border-b p-8">
                        <CardTitle className="text-sm font-black uppercase tracking-widest text-slate-500">Привязать новую группу</CardTitle>
                    </CardHeader>
                    <CardContent className="p-10 space-y-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label className="text-[11px] font-black uppercase text-slate-400 ml-1">Telegram Chat ID</Label>
                                <Input 
                                    placeholder="-100..." 
                                    value={newGroupId} 
                                    onChange={e => setNewGroupId(e.target.value)}
                                    className="h-14 rounded-2xl bg-slate-50 border-none font-bold placeholder:text-slate-300" 
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[11px] font-black uppercase text-slate-400 ml-1">Название (для реестра)</Label>
                                <Input 
                                    placeholder="Снабжение / Бухгалтерия" 
                                    value={newGroupName} 
                                    onChange={e => setNewGroupName(e.target.value)}
                                    className="h-14 rounded-2xl bg-slate-50 border-none font-bold placeholder:text-slate-300" 
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label className="text-[11px] font-black uppercase text-slate-400 ml-1">Фирма по умолчанию (для баланса)</Label>
                                <Select value={selectedCompanyId} onValueChange={(val) => {
                                    setSelectedCompanyId(val);
                                    setSelectedAccountId('');
                                }}>
                                    <SelectTrigger className="h-14 rounded-2xl bg-slate-50 border-none font-bold text-slate-700 focus:ring-2 focus:ring-primary/20 transition-all">
                                        <SelectValue placeholder="Выберите фирму" />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-2xl border-none shadow-xl">
                                        {companies.map(c => (
                                            <SelectItem key={c.id} value={c.id} className="rounded-xl">{c.brandName} ({c.legalName})</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[11px] font-black uppercase text-slate-400 ml-1">Счет по умолчанию (для списания/начисления)</Label>
                                <Select value={selectedAccountId} onValueChange={setSelectedAccountId} disabled={!selectedCompanyId}>
                                    <SelectTrigger className="h-14 rounded-2xl bg-slate-50 border-none font-bold text-slate-700 focus:ring-2 focus:ring-primary/20 transition-all">
                                        <SelectValue placeholder={selectedCompanyId ? "Выберите счет" : "Сначала выберите фирму"} />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-2xl border-none shadow-xl">
                                        {filteredAccountsForNewGroup.map(a => (
                                            <SelectItem key={a.id} value={a.id} className="rounded-xl">{a.bankName} ({a.accountNumber})</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <Label className="text-[11px] font-black uppercase text-slate-400 ml-1">Специализация этой группы</Label>
                            <div className="flex gap-4">
                                <Button 
                                    type="button"
                                    onClick={() => setNewGroupType('PROCUREMENT')}
                                    className={cn(
                                        "flex-1 h-20 rounded-2xl gap-4 font-black uppercase text-[10px] tracking-widest transition-all",
                                        newGroupType === 'PROCUREMENT' ? "bg-black text-white scale-100 shadow-xl" : "bg-slate-50 text-slate-400 opacity-60 hover:opacity-100"
                                    )}
                                >
                                    <Truck className={cn("w-6 h-6", newGroupType === 'PROCUREMENT' ? "text-amber-400" : "text-slate-300")} /> 
                                    Снабжение (Топики)
                                </Button>
                                <Button 
                                    type="button"
                                    onClick={() => setNewGroupType('FINANCE')}
                                    className={cn(
                                        "flex-1 h-20 rounded-2xl gap-4 font-black uppercase text-[10px] tracking-widest transition-all",
                                        newGroupType === 'FINANCE' ? "bg-black text-white scale-100 shadow-xl" : "bg-slate-50 text-slate-400 opacity-60 hover:opacity-100"
                                    )}
                                >
                                    <Landmark className={cn("w-6 h-6", newGroupType === 'FINANCE' ? "text-blue-400" : "text-slate-300")} /> 
                                    Финансы (Чеки)
                                </Button>
                            </div>
                        </div>

                        <Button 
                            onClick={handleAddGroup}
                            disabled={!newGroupId}
                            className="w-full h-16 rounded-[2rem] bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase text-xs tracking-widest"
                        >
                            <Plus className="w-5 h-5 mr-3" /> Зарегистрировать группу
                        </Button>
                    </CardContent>
                </Card>

                {/* СПИСОК ГРУПП (ЕДИНЫЙ РЕЕСТР) */}
                <Card className="rounded-[2.5rem] border-none shadow-2xl overflow-hidden">
                    <CardHeader className="p-8 pb-0">
                        <CardTitle className="flex items-center gap-3">
                            <Users className="w-6 h-6 text-blue-600" />
                            <span className="text-xl font-bold">Активные группы и их Темы (Topics)</span>
                        </CardTitle>
                        <CardDescription>Управляйте маршрутизацией сообщений внутри Telegram.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-8 space-y-6">
                        {groupsList && groupsList.length > 0 ? (
                            groupsList.map((group) => (
                                <div key={group.id} className="space-y-6 p-8 bg-slate-50 rounded-[2.5rem] border border-slate-100 transition-all hover:shadow-lg">
                                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                                        <div className="flex gap-4 items-center">
                                            <div className={cn(
                                                "p-5 rounded-[1.5rem] transition-colors",
                                                group.type === 'PROCUREMENT' ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"
                                            )}>
                                                {group.type === 'PROCUREMENT' ? <Truck className="w-8 h-8" /> : <Landmark className="w-8 h-8" />}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-3 mb-1">
                                                    <h4 className="font-black text-xl uppercase tracking-tighter">{group.name}</h4>
                                                    <Badge className={cn(
                                                        "text-[9px] font-black rounded-lg border-none",
                                                        group.type === 'PROCUREMENT' ? "bg-amber-200 text-amber-900" : "bg-blue-200 text-blue-900"
                                                    )}>
                                                        {group.type}
                                                    </Badge>
                                                </div>
                                                <code className="text-[10px] text-slate-400 font-mono">Chat ID: {group.chatId}</code>
                                                <div className="flex gap-2 mt-2">
                                                    {group.defaultCompanyId && (
                                                        <Badge variant="outline" className="text-[9px] font-bold bg-white text-indigo-600 border-indigo-100 flex items-center gap-1">
                                                            <Building2 className="w-3 h-3 text-indigo-500" />
                                                            {companies.find(c => c.id === group.defaultCompanyId)?.brandName || 'Фирма удалена'}
                                                        </Badge>
                                                    )}
                                                    {group.defaultAccountId && (
                                                        <Badge variant="outline" className="text-[9px] font-bold bg-white text-emerald-600 border-emerald-100 flex items-center gap-1">
                                                            <Landmark className="w-3 h-3 text-emerald-500" />
                                                            {accounts.find(a => a.id === group.defaultAccountId)?.bankName || 'Счет удален'}
                                                        </Badge>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <div className="flex flex-wrap items-center gap-4">
                                            <div className="flex items-center gap-4 bg-white px-5 py-3 rounded-2xl border border-slate-100 shadow-sm">
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    onClick={async () => {
                                                        const res = await testTelegramGroupAction(group.chatId, group.topics?.requests);
                                                        if (res.success) toast({ title: 'Тест отправлен!', description: 'Проверьте Telegram.' });
                                                        else toast({ variant: 'destructive', title: 'Ошибка теста', description: res.error });
                                                    }}
                                                    className="h-10 w-10 rounded-xl hover:bg-emerald-50 text-emerald-500"
                                                >
                                                    <Zap className="w-4 h-4" />
                                                </Button>
                                                <div className="w-px h-6 bg-slate-100 mx-1" />
                                                <EditGroupDialog 
                                                    group={group} 
                                                    companies={companies}
                                                    accounts={accounts}
                                                    onUpdate={async (data) => {
                                                        await updateDoc(doc(firestore!, 'telegram_groups', group.id), data);
                                                        toast({ title: 'Настройки обновлены' });
                                                    }} 
                                                />
                                                <div className="w-px h-6 bg-slate-100 mx-1" />
                                                <Switch 
                                                    checked={group.isActive}
                                                    onCheckedChange={() => toggleGroup(group.id, group.isActive)}
                                                />
                                                <Button variant="ghost" size="icon" onClick={() => deleteGroup(group.id)} className="text-rose-400 hover:text-rose-600 ml-2">
                                                    <Trash2 className="w-5 h-5" />
                                                </Button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* НАСТРОЙКА ТОПИКОВ (ДЛЯ PROCUREMENT) */}
                                    {group.type === 'PROCUREMENT' && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-4 pt-8 border-t border-slate-200/50">
                                            <div className="space-y-2">
                                                <Label className="text-[9px] font-black uppercase text-slate-400 flex items-center gap-2">
                                                    <MessageSquare className="w-3 h-3 text-blue-500" /> 1. Разбор групп
                                                </Label>
                                                <Input 
                                                    placeholder="ID" 
                                                    type="number"
                                                    defaultValue={group.topics?.requests || ''}
                                                    onBlur={(e) => {
                                                        updateDoc(doc(firestore!, 'telegram_groups', group.id), {
                                                            'topics.requests': parseInt(e.target.value) || null
                                                        });
                                                    }}
                                                    className="h-10 rounded-xl bg-white border-none font-bold text-xs shadow-sm"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-[9px] font-black uppercase text-slate-400 flex items-center gap-2 text-amber-600">
                                                    <Truck className="w-3 h-3" /> 2. В ожидании
                                                </Label>
                                                <Input 
                                                    placeholder="ID" 
                                                    type="number"
                                                    defaultValue={group.topics?.pending || ''}
                                                    onBlur={(e) => {
                                                        updateDoc(doc(firestore!, 'telegram_groups', group.id), {
                                                            'topics.pending': parseInt(e.target.value) || null
                                                        });
                                                    }}
                                                    className="h-10 rounded-xl bg-white border-none font-bold text-xs shadow-sm"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-[9px] font-black uppercase text-slate-400 flex items-center gap-2 text-emerald-600">
                                                    <CheckCircle2 className="w-3 h-3" /> 3. Зона Приемки
                                                </Label>
                                                <Input 
                                                    placeholder="ID" 
                                                    type="number"
                                                    defaultValue={group.topics?.reception || ''}
                                                    onBlur={(e) => {
                                                        updateDoc(doc(firestore!, 'telegram_groups', group.id), {
                                                            'topics.reception': parseInt(e.target.value) || null
                                                        });
                                                    }}
                                                    className="h-10 rounded-xl bg-white border-none font-bold text-xs shadow-sm"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-[9px] font-black uppercase text-slate-400 flex items-center gap-2 text-rose-500">
                                                    <Zap className="w-3 h-3" /> 4. Финал (Фото)
                                                </Label>
                                                <Input 
                                                    placeholder="ID" 
                                                    type="number"
                                                    defaultValue={group.topics?.final || ''}
                                                    onBlur={(e) => {
                                                        updateDoc(doc(firestore!, 'telegram_groups', group.id), {
                                                            'topics.final': parseInt(e.target.value) || null
                                                        });
                                                    }}
                                                    className="h-10 rounded-xl bg-white border-none font-bold text-xs shadow-sm"
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-20 bg-slate-50 rounded-[3rem] border-2 border-dashed border-slate-200">
                                <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                                <p className="text-slate-400 font-bold uppercase text-xs tracking-widest">Группы не привязаны</p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* DIAGNOSTICS */}
                <Card className="rounded-[2.5rem] border-none shadow-2xl overflow-hidden bg-slate-900 text-white">
                    <CardHeader className="p-8 border-b border-white/10">
                        <CardTitle className="flex items-center gap-3 text-sm font-black uppercase tracking-widest text-slate-400">
                            <Terminal className="w-5 h-5" /> Сервисный Инструментарий
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-10 space-y-10">
                        <div className="space-y-4">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Состояние Telegram Bot API</Label>
                            <div className="flex gap-4">
                                <Button 
                                    onClick={handleCheckBot}
                                    disabled={isChecking}
                                    variant="outline"
                                    className="bg-white/5 border-white/10 hover:bg-white/10 text-white h-14 rounded-2xl font-bold"
                                >
                                    {isChecking ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                                    Проверить статус бота
                                </Button>
                                {botInfo && (
                                    <div className={cn(
                                        "flex items-center gap-3 px-6 rounded-2xl text-xs font-black uppercase tracking-widest",
                                        botInfo.ok ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400"
                                    )}>
                                        <div className={cn("w-2 h-2 rounded-full", botInfo.ok ? "bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.5)]" : "bg-rose-400")} />
                                        {botInfo.ok ? `@${botInfo.result.username} Online` : 'Invalid Token'}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="space-y-4">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Маршрут входящих данных (Webhook)</Label>
                            <div className="flex gap-4">
                                <div className="relative flex-1 group">
                                    <LinkIcon className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 transition-colors group-focus-within:text-blue-400" />
                                    <Input 
                                        placeholder="https://your-domain.com/api/telegram-webhook" 
                                        value={webhookUrl}
                                        onChange={e => setWebhookUrl(e.target.value)}
                                        className="h-16 pl-14 rounded-2xl bg-white/5 border-white/10 text-white font-mono text-sm transition-all focus:bg-white/10 focus:border-blue-500"
                                    />
                                </div>
                                <Button 
                                    onClick={handleSetWebhook}
                                    disabled={!webhookUrl}
                                    className="h-16 px-10 rounded-2xl bg-blue-600 hover:bg-blue-700 font-black uppercase text-[11px] tracking-widest shadow-xl shadow-blue-900/20"
                                >
                                    Привязать URL
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* ИСТОРИЯ (TOPIC DISCOVERY) */}
                <Card className="rounded-[2.5rem] border-none shadow-2xl overflow-hidden">
                    <CardHeader className="p-8 flex flex-row items-center justify-between border-b bg-slate-50/50">
                        <div className="flex items-center gap-3">
                            <History className="w-6 h-6 text-slate-600" />
                            <CardTitle className="text-xl font-bold italic">Discovery Log (Topic ID Finder)</CardTitle>
                        </div>
                        <Button variant="ghost" size="sm" onClick={handleClearLogs} className="rounded-xl text-slate-400 hover:text-rose-600 font-bold uppercase text-[9px]">
                            Clear History
                        </Button>
                    </CardHeader>
                    <CardContent className="p-2">
                        <div className="max-h-[500px] overflow-y-auto space-y-2 p-4">
                            {logs && logs.length > 0 ? (
                                logs.map((log) => (
                                    <div key={log.id} className="p-5 hover:bg-slate-50 transition-all rounded-3xl group flex gap-5 items-start border border-transparent hover:border-slate-100">
                                        <div className="mt-1">
                                            {log.updateType === 'photo' ? (
                                                <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl"><ImageIcon className="w-5 h-5" /></div>
                                            ) : log.updateType === 'callback' ? (
                                                <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl"><MousePointer2 className="w-5 h-5" /></div>
                                            ) : (
                                                <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl"><MessageSquare className="w-5 h-5" /></div>
                                            )}
                                        </div>
                                        <div className="flex-1 space-y-2">
                                            <div className="flex justify-between items-center">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-black text-slate-900 text-sm">@{log.sender}</span>
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{log.chatTitle}</span>
                                                    {log.raw?.message?.message_thread_id && (
                                                        <Badge className="bg-indigo-600 text-white font-black text-[9px] px-2 py-0.5 shadow-lg shadow-indigo-200">
                                                            TOPIC ID: {log.raw.message.message_thread_id}
                                                        </Badge>
                                                    )}
                                                </div>
                                                <span className="text-[10px] font-mono text-slate-300">
                                                    {log.createdAt?.toDate ? log.createdAt.toDate().toLocaleTimeString() : '...'}
                                                </span>
                                            </div>
                                            <p className="text-sm text-slate-500 font-medium leading-relaxed">{log.preview}</p>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-24 text-slate-300 space-y-4">
                                    <MessageSquare className="w-16 h-16 mx-auto opacity-10" />
                                    <p className="font-black uppercase text-[10px] tracking-widest opacity-40">Listening for Telegram events...</p>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

function EditGroupDialog({ group, onUpdate, companies, accounts }: { 
    group: any, 
    onUpdate: (data: any) => Promise<void>,
    companies: any[],
    accounts: any[]
}) {
    const [open, setOpen] = useState(false);
    const [name, setName] = useState(group.name);
    const [type, setType] = useState(group.type);
    const [chatId, setChatId] = useState(group.chatId);
    const [topics, setTopics] = useState(group.topics || { requests: '', pending: '', reception: '', final: '' });
    const [defaultCompanyId, setDefaultCompanyId] = useState(group.defaultCompanyId || '');
    const [defaultAccountId, setDefaultAccountId] = useState(group.defaultAccountId || '');
    const [loading, setLoading] = useState(false);

    const filteredAccounts = React.useMemo(() => {
        if (!defaultCompanyId) return [];
        return accounts.filter(acc => acc.companyId === defaultCompanyId);
    }, [accounts, defaultCompanyId]);

    const handleSave = async () => {
        setLoading(true);
        await onUpdate({ 
            name, 
            type, 
            chatId,
            defaultCompanyId: defaultCompanyId || null,
            defaultAccountId: defaultAccountId || null,
            topics: {
                requests: Number(topics.requests) || null,
                pending: Number(topics.pending) || null,
                reception: Number(topics.reception) || null,
                final: Number(topics.final) || null,
            }
        });
        setLoading(false);
        setOpen(false);
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl hover:bg-slate-100">
                    <Pencil className="w-4 h-4 text-slate-400" />
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px] rounded-[2.5rem] border-none shadow-2xl p-0 overflow-hidden">
                <DialogHeader className="p-8 bg-slate-50 border-b">
                    <DialogTitle className="text-xl font-black uppercase tracking-tight flex items-center gap-2">
                        <Settings2 className="w-5 h-5 text-blue-600" /> Глубокая настройка
                    </DialogTitle>
                </DialogHeader>
                <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto scrollbar-hide">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <Label className="text-[9px] font-black uppercase text-slate-400 ml-1">Имя группы</Label>
                            <Input value={name} onChange={(e) => setName(e.target.value)} className="h-11 rounded-xl bg-slate-50 border-none font-bold" />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-[9px] font-black uppercase text-slate-400 ml-1">Chat ID</Label>
                            <Input value={chatId} onChange={(e) => setChatId(e.target.value)} className="h-11 rounded-xl bg-slate-50 border-none font-mono text-xs font-bold" />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <Label className="text-[9px] font-black uppercase text-slate-400 ml-1">Фирма по умолчанию</Label>
                            <Select value={defaultCompanyId} onValueChange={(val) => {
                                setDefaultCompanyId(val);
                                setDefaultAccountId('');
                            }}>
                                <SelectTrigger className="h-11 rounded-xl bg-slate-50 border-none font-bold">
                                    <SelectValue placeholder="Выберите фирму" />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl border-none shadow-xl">
                                    {companies.map(c => (
                                        <SelectItem key={c.id} value={c.id} className="rounded-lg">{c.brandName} ({c.legalName})</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1">
                            <Label className="text-[9px] font-black uppercase text-slate-400 ml-1">Счет по умолчанию</Label>
                            <Select value={defaultAccountId} onValueChange={setDefaultAccountId} disabled={!defaultCompanyId}>
                                <SelectTrigger className="h-11 rounded-xl bg-slate-50 border-none font-bold">
                                    <SelectValue placeholder={defaultCompanyId ? "Выберите счет" : "Сначала выберите фирму"} />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl border-none shadow-xl">
                                    {filteredAccounts.map(a => (
                                        <SelectItem key={a.id} value={a.id} className="rounded-lg">{a.bankName} ({a.accountNumber})</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="space-y-1">
                        <Label className="text-[9px] font-black uppercase text-slate-400 ml-1">Специализация</Label>
                        <Select value={type} onValueChange={setType}>
                            <SelectTrigger className="h-11 rounded-xl bg-slate-50 border-none font-bold">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl border-none shadow-xl">
                                <SelectItem value="PROCUREMENT" className="rounded-lg">Снабжение</SelectItem>
                                <SelectItem value="FINANCE" className="rounded-lg">Финансы</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {type === 'PROCUREMENT' && (
                        <div className="space-y-4 pt-4 border-t border-dashed">
                            <p className="text-[10px] font-black uppercase text-amber-600 tracking-widest">Маршрутизация Топиков (Thread IDs)</p>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <Label className="text-[9px] font-black text-slate-400">1. Разбор групп</Label>
                                    <Input 
                                        value={topics.requests || ''} 
                                        onChange={(e) => setTopics({...topics, requests: e.target.value})} 
                                        placeholder="ID" className="h-11 rounded-xl bg-slate-50 border-none font-bold" 
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-[9px] font-black text-slate-400">2. В ожидании</Label>
                                    <Input 
                                        value={topics.pending || ''} 
                                        onChange={(e) => setTopics({...topics, pending: e.target.value})} 
                                        placeholder="ID" className="h-11 rounded-xl bg-slate-50 border-none font-bold" 
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-[9px] font-black text-slate-400">3. Зона приемки</Label>
                                    <Input 
                                        value={topics.reception || ''} 
                                        onChange={(e) => setTopics({...topics, reception: e.target.value})} 
                                        placeholder="ID" className="h-11 rounded-xl bg-slate-50 border-none font-bold" 
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-[9px] font-black text-slate-400">4. Финал (Фото)</Label>
                                    <Input 
                                        value={topics.final || ''} 
                                        onChange={(e) => setTopics({...topics, final: e.target.value})} 
                                        placeholder="ID" className="h-11 rounded-xl bg-slate-50 border-none font-bold" 
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    <DialogFooter className="pt-4">
                        <Button 
                            onClick={handleSave} 
                            disabled={loading}
                            className="w-full h-14 rounded-2xl bg-black text-white font-black uppercase text-[10px] tracking-widest"
                        >
                            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Обновить конфигурацию'}
                        </Button>
                    </DialogFooter>
                </div>
            </DialogContent>
        </Dialog>
    );
}
