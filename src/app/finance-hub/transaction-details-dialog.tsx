'use client';

import { useState } from 'react';
import { FinanceTransaction } from '@/lib/types/finance';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Trash2, History, AlertTriangle, Loader2 } from 'lucide-react';
import { deleteTransactionAction } from './actions';
import { useUser } from '@/firebase/hooks';
import { useToast } from '@/hooks/use-toast';
import { useFirebase } from '@/firebase/provider';

export function TransactionDetailsDialog({ 
    transaction, 
    children 
}: { 
    transaction: FinanceTransaction;
    children: React.ReactNode;
}) {
    const { orgId } = useFirebase();
    const [open, setOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const { user } = useUser();
    const { toast } = useToast();

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'completed': return 'Проведено';
            case 'pending': return 'Ожидает';
            case 'rejected': return 'Отклонено';
            default: return status;
        }
    };

    const handleDelete = async () => {
        if (!window.confirm('Вы уверены, что хотите удалить эту транзакцию? Балансы будут пересчитаны автоматически.')) return;
        
        setIsDeleting(true);
        try {
            const userName = user?.displayName || user?.email || 'Admin';
            const userId = user?.uid || 'system';
            if (!orgId) {
                toast({ variant: 'destructive', title: 'Ошибка', description: 'Организация не определена' });
                return;
            }
            await deleteTransactionAction(orgId, transaction.id, userName, userId);
            toast({
                title: 'Удалено',
                description: 'Транзакция удалена, балансы обновлены.',
            });
            setOpen(false);
        } catch (e) {
            toast({
                title: 'Ошибка',
                description: 'Не удалось удалить транзакцию',
                variant: 'destructive',
            });
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            {children}
            
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl">
                <DialogHeader>
                    <div className="flex items-center justify-between mt-4">
                        <DialogTitle className="text-2xl font-black uppercase tracking-tight">
                            Детали Транзакции
                        </DialogTitle>
                        <Badge variant={transaction.status === 'completed' ? 'default' : transaction.status === 'rejected' ? 'destructive' : 'outline'}>
                            {getStatusLabel(transaction.status)}
                        </Badge>
                    </div>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    {/* Сумма и тип */}
                    <div className="flex items-center gap-4 p-6 bg-slate-50 rounded-2xl border border-slate-100">
                        <div className="flex-1">
                            <Label className="text-[10px] uppercase font-bold text-slate-400 tracking-widest mb-1 block">
                                Итоговая Сумма
                            </Label>
                            <div className={`text-4xl font-black ${transaction.type === 'income' ? 'text-green-600' : transaction.type === 'expense' ? 'text-red-600' : 'text-slate-800'}`}>
                                {transaction.type === 'income' ? '+' : transaction.type === 'expense' ? '-' : ''}
                                {transaction.amount?.toLocaleString('ru-RU')} <span className="text-xl text-slate-400">{transaction.currency}</span>
                            </div>
                        </div>
                        <div className="text-right">
                            <Label className="text-[10px] uppercase font-bold text-slate-400 tracking-widest mb-1 block">
                                Тип Операции
                            </Label>
                            <div className="font-bold text-slate-700">
                                {transaction.type === 'income' ? 'Приход' : transaction.type === 'expense' ? 'Расход' : 'Неизвестно'}
                            </div>
                            <div className="text-xs text-slate-400 mt-1">
                                Источник: {transaction.source}
                            </div>
                        </div>
                    </div>

                    {/* Контрагент */}
                    <div>
                        <Label className="text-[10px] uppercase font-bold text-slate-400 tracking-widest mb-2 block">
                            Участники (Контрагент)
                        </Label>
                        <div className="p-4 border rounded-xl space-y-3 bg-white shadow-sm">
                            <div className="flex justify-between items-start">
                                <div>
                                    <div className="text-sm font-black text-slate-800">{transaction.counterparty || 'Не указано'}</div>
                                    {transaction.counterpartyInn && (
                                        <div className="text-xs text-slate-500 font-mono mt-1">ИНН: {transaction.counterpartyInn}</div>
                                    )}
                                </div>
                                {transaction.contractorId && (
                                    <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-none">
                                        В базе поставщиков
                                    </Badge>
                                )}
                            </div>
                            {transaction.counterpartyAccount && (
                                <div className="text-xs bg-slate-50 p-2 rounded-lg font-mono text-slate-600 border border-slate-100 break-all">
                                    Счет/Реквизиты: {transaction.counterpartyAccount}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Назначение */}
                    <div>
                        <Label className="text-[10px] uppercase font-bold text-slate-400 tracking-widest mb-2 block">
                            Назначение платежа / Комментарий
                        </Label>
                        <div className="p-4 border rounded-xl bg-amber-50/50 border-amber-100 text-sm text-slate-700 leading-relaxed italic">
                            {transaction.comment || transaction.paymentPurpose || '—'}
                            {transaction.paymentCode && (
                                <div className="mt-2 text-xs font-bold font-mono text-blue-600">
                                    Код платежа: {transaction.paymentCode}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Фото чека */}
                    {transaction.receiptImageUrl && (
                        <div>
                            <Label className="text-[10px] uppercase font-bold text-slate-400 tracking-widest mb-2 block">
                                Скриншот / Фото документа
                            </Label>
                            <div className="rounded-2xl overflow-hidden border shadow-lg group relative bg-slate-100">
                                <img 
                                    src={transaction.receiptImageUrl} 
                                    alt="Receipt" 
                                    className="w-full h-auto max-h-[400px] object-contain transition-transform duration-500 group-hover:scale-105"
                                />
                                <a 
                                    href={transaction.receiptImageUrl} 
                                    target="_blank" 
                                    rel="noreferrer"
                                    className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <span className="bg-white px-4 py-2 rounded-xl text-xs font-bold shadow-xl flex items-center gap-2">
                                        <History className="w-4 h-4" /> Открыть оригинал
                                    </span>
                                </a>
                            </div>
                        </div>
                    )}

                    {/* Системная информация */}
                    <div>
                         <Label className="text-[10px] uppercase font-bold text-slate-400 tracking-widest mb-2 block">
                            Метаданные документа
                        </Label>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-3 border rounded-xl bg-slate-50 shadow-inner">
                                <Label className="text-[9px] uppercase font-bold text-slate-400 block mb-1">Документ от</Label>
                                <div className="text-xs font-bold text-slate-700">
                                    {transaction.date || 'Не распознано'}
                                </div>
                            </div>
                            <div className="p-3 border rounded-xl bg-slate-50 shadow-inner">
                                <Label className="text-[9px] uppercase font-bold text-slate-400 block mb-1">Создано в хабе</Label>
                                <div className="text-xs font-bold text-slate-700">
                                    {transaction.createdAt?.seconds ? format(transaction.createdAt.seconds * 1000, 'dd MMM yyyy, HH:mm', { locale: ru }) : '—'}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Ошибки ИИ */}
                    {transaction.metadata?.aiError && (
                        <div className="p-4 bg-red-50 border border-red-100 rounded-xl space-y-1">
                             <Label className="text-[10px] uppercase font-black text-red-600 tracking-widest block">
                                Ошибка распознавания (AI)
                            </Label>
                            <p className="text-sm text-red-800">{transaction.metadata.aiComment || transaction.metadata.aiError}</p>
                        </div>
                    )}
                    {/* История изменений */}
                    {transaction.metadata?.history && transaction.metadata.history.length > 0 && (
                        <div className="space-y-3">
                            <Label className="text-[10px] uppercase font-bold text-slate-400 tracking-widest flex items-center gap-2">
                                <History className="w-3 h-3" /> История изменений
                            </Label>
                            <div className="border rounded-xl divide-y bg-slate-50/50 overflow-hidden">
                                {transaction.metadata.history.map((entry: any, idx: number) => (
                                    <div key={idx} className="p-3 text-[11px] flex justify-between items-start hover:bg-white transition-colors">
                                        <div className="space-y-1">
                                            <div className="font-bold text-slate-700">
                                                {entry.action === 'create' ? 'Создание' : 
                                                 entry.action === 'status_change' ? `Смена статуса: ${entry.changes?.status?.new}` : 
                                                 entry.action}
                                            </div>
                                            <div className="text-slate-500 italic opacity-70">
                                                By {entry.userName || 'System'}
                                            </div>
                                        </div>
                                        <div className="text-right text-slate-400 font-mono text-[9px]">
                                            {entry.date?.seconds ? format(entry.date.seconds * 1000, 'dd.MM.yy HH:mm') : 
                                             format(new Date(entry.date), 'dd.MM.yy HH:mm')}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ACTIONS */}
                    <div className="pt-6 border-t flex justify-between items-center bg-white">
                        <div className="text-[10px] text-muted-foreground italic flex items-center gap-1 opacity-60">
                            <AlertTriangle className="w-3 h-3 text-amber-500" /> Удаление вернет деньги на счета
                        </div>
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-red-500 hover:text-red-700 hover:bg-red-50 font-bold gap-2 text-xs"
                            onClick={handleDelete}
                            disabled={isDeleting}
                        >
                            {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                            Удалить транзакцию
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
