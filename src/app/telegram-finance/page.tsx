import { getTelegramTransactionsAction, TelegramTransaction } from './actions';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ReceiptUploader } from './receipt-uploader';

export default async function TelegramFinancePage() {
    const transactions: TelegramTransaction[] = await getTelegramTransactionsAction();

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight text-gradient bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600 uppercase">
                    Telegram Финансы
                </h1>
                <p className="text-muted-foreground mt-2">
                    Распознавание транзакций и банковских чеков через ИИ-ассистента Gemini.
                </p>
            </div>

            <ReceiptUploader />

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {transactions.map((tx) => (
                    <Card key={tx.id}>
                        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                            <CardTitle className="text-sm font-medium">
                                @{tx.senderUsername}
                            </CardTitle>
                            {tx.status === 'pending' && <Badge variant="outline" className="bg-yellow-100 text-yellow-800">Ожидает</Badge>}
                            {tx.status === 'approved' && <Badge variant="default" className="bg-green-100 text-green-800 border-none hover:bg-green-100">Принято</Badge>}
                            {tx.status === 'rejected' && <Badge variant="destructive">Отклонено</Badge>}
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">
                                {tx.parsedAiData.amount?.toLocaleString('ru-RU')} ₸
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                                {tx.parsedAiData.type === 'income' ? '🟢 Приход' : tx.parsedAiData.type === 'expense' ? '🔴 Расход' : '⚪ Транзакция'}
                            </p>
                            <div className="mt-4 text-sm space-y-2 border-t pt-4">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Источник:</span>
                                    <span className="font-medium">{tx.parsedAiData.bank_or_source}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Контрагент:</span>
                                    <span className="font-medium text-right">{tx.parsedAiData.counterparty}</span>
                                </div>
                                {tx.parsedAiData.inn && (
                                    <div className="flex justify-between text-xs">
                                        <span className="text-muted-foreground">ИНН:</span>
                                        <code>{tx.parsedAiData.inn}</code>
                                    </div>
                                )}
                                {tx.parsedAiData.account_number && (
                                    <div className="flex flex-col text-xs mt-1">
                                        <span className="text-muted-foreground">Счет:</span>
                                        <code className="bg-muted p-1 rounded mt-1 truncate">{tx.parsedAiData.account_number}</code>
                                    </div>
                                )}
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Дата:</span>
                                    <span className="font-medium">{tx.parsedAiData.date || '—'}</span>
                                </div>
                                
                                {tx.parsedAiData.purpose && (
                                    <div className="mt-2 p-2 bg-blue-50 text-blue-900 text-xs rounded border border-blue-100">
                                        <span className="font-bold block mb-1">Назначение платежа:</span>
                                        {tx.parsedAiData.purpose}
                                    </div>
                                )}

                                {tx.parsedAiData.comment && !tx.parsedAiData.purpose && (
                                    <div className="text-muted-foreground mt-2 italic border-l-2 pl-2">
                                        «{tx.parsedAiData.comment}»
                                    </div>
                                )}
                            </div>
                            
                            {tx.status === 'approved' && tx.approvedByUsername && (
                                <p className="text-xs text-green-600 mt-4 border-t pt-2">
                                    Одобрено: @{tx.approvedByUsername}
                                </p>
                            )}
                            {tx.status === 'rejected' && tx.rejectedByUsername && (
                                <p className="text-xs text-red-600 mt-4 border-t pt-2">
                                    Отклонено: @{tx.rejectedByUsername}
                                </p>
                            )}
                        </CardContent>
                    </Card>
                ))}
            </div>
            
            {transactions.length === 0 && (
                <div className="text-center py-10 border rounded-lg bg-muted text-muted-foreground">
                    Транзакций из Telegram пока нет. Отправьте чек в группу!
                </div>
            )}
        </div>
    );
}
