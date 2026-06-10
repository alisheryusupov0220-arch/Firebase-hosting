'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Check, X, Loader2, Info } from 'lucide-react';
import { updateTransactionStatusAction } from './actions';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/firebase/hooks';

import { BankAccount, FinanceTransaction } from '@/lib/types/finance';
import { 
    Popover, 
    PopoverContent, 
    PopoverTrigger 
} from '@/components/ui/popover';
import { Label } from '@/components/ui/label';

export function TransactionActionButtons({ 
    orgId,
    transaction, 
    accounts = [] 
}: { 
    orgId: string;
    transaction: FinanceTransaction;
    accounts?: BankAccount[];
}) {
    const [loadingAction, setLoadingAction] = useState<'completed' | 'rejected' | null>(null);
    const [selectedAccountId, setSelectedAccountId] = useState<string>('');
    const { toast } = useToast();
    const { user } = useUser();

    // Предиктивный выбор счета (AI Match или Default)
    useEffect(() => {
        if (transaction.myAccountId) {
            setSelectedAccountId(transaction.myAccountId);
        } else if (accounts.length > 0) {
            const defaultAcc = accounts.find(a => a.isDefault) || accounts[0];
            setSelectedAccountId(defaultAcc.id);
        }
    }, [transaction.myAccountId, accounts]);

    const handleAction = async (status: 'completed' | 'rejected', accountId?: string) => {
        setLoadingAction(status);
        try {
            const userName = user?.displayName || user?.email || 'Admin';
            await updateTransactionStatusAction(orgId, transaction.id, status, userName, 'system', accountId);
            toast({
                title: status === 'completed' ? 'Успешно' : 'Отклонено',
                description: status === 'completed' ? 'Транзакция подтверждена. Балансы обновлены.' : 'Транзакция отклонена',
                variant: status === 'completed' ? 'default' : 'destructive',
            });
        } catch (e) {
            toast({
                title: 'Ошибка',
                description: 'Не удалось обновить статус',
                variant: 'destructive',
            });
        } finally {
            setLoadingAction(null);
        }
    };

    return (
        <div className="flex items-center gap-2 mt-3">
            <Popover>
                <PopoverTrigger asChild onClick={(e) => e.stopPropagation()}>
                    <Button 
                        size="sm" 
                        variant="outline" 
                        className="bg-green-50 text-green-700 hover:bg-green-100 hover:text-green-800 border-green-200 h-7 rounded-lg text-[11px] font-bold px-3 transition-colors"
                        disabled={!!loadingAction}
                    >
                        {loadingAction === 'completed' ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Check className="w-3 h-3 mr-1" />}
                        Подтвердить
                    </Button>
                </PopoverTrigger>
                <PopoverContent 
                    className="w-64 p-4 rounded-xl shadow-2xl bg-white border-slate-100"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="space-y-4">
                        {accounts.length > 0 ? (
                            <>
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                            Выберите расчетный счет
                                        </Label>
                                        {transaction.myAccountId && (
                                            <div className="flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full text-[9px] font-black animate-pulse">
                                                <Info className="w-2 h-2" />
                                                ИИ МАТЧ
                                            </div>
                                        )}
                                    </div>
                                    <select 
                                        className="w-full p-2 text-xs border rounded-lg bg-slate-50 font-bold text-slate-700 focus:ring-0 outline-none"
                                        value={selectedAccountId}
                                        onChange={(e) => setSelectedAccountId(e.target.value)}
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <option value="">Счет не выбран...</option>
                                        {accounts.map(acc => (
                                            <option key={acc.id} value={acc.id}>
                                                {acc.bankName} (...{acc.accountNumber?.slice(-4)}) {acc.isDefault ? '⭐' : ''}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <Button 
                                    className="w-full h-10 bg-green-600 hover:bg-black text-[10px] font-black uppercase tracking-widest text-white rounded-lg shadow-lg active:scale-95 transition-all"
                                    onClick={(e) => { e.stopPropagation(); handleAction('completed', selectedAccountId); }}
                                    disabled={!selectedAccountId || !!loadingAction}
                                >
                                    Провести платеж
                                </Button>
                            </>
                        ) : (
                            <div className="text-center py-4">
                                <p className="text-[10px] font-bold text-red-500 uppercase leading-relaxed">
                                    Нет доступных счетов.<br/>
                                    <span className="text-slate-400">Сначала добавьте банковский счет в разделе "Банки и счета".</span>
                                </p>
                            </div>
                        )}
                    </div>
                </PopoverContent>
            </Popover>

            <Button 
                size="sm" 
                variant="outline" 
                className="bg-red-50 text-red-700 hover:bg-red-100 hover:text-red-800 border-red-200 h-7 rounded-lg text-[11px] font-bold px-3 transition-colors"
                onClick={(e) => { e.stopPropagation(); handleAction('rejected'); }}
                disabled={!!loadingAction}
            >
                {loadingAction === 'rejected' ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <X className="w-3 h-3 mr-1" />}
                Отклонить
            </Button>
        </div>
    );
}
