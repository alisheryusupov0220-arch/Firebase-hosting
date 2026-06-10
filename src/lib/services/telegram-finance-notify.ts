import { adminDb } from '@/firebase/server';
import { sendMessage } from './telegram-finance';

/**
 * Сервис уведомлений для Финансового Хаба в Telegram
 */

export async function notifyFinanceTransaction(txId: string, txData: any, eventType: 'CREATED' | 'STATUS_CHANGE' | 'AI_SCAN') {
    try {
        const { amount, currency, counterparty, type, status, comment, source } = txData;
        const formattedAmount = new Intl.NumberFormat('ru-RU').format(amount || 0);
        
        let title = '';
        if (eventType === 'CREATED') title = '➕ <b>НОВАЯ ОПЕРАЦИЯ</b>';
        else if (eventType === 'STATUS_CHANGE') title = '🔄 <b>ИЗМЕНЕНИЕ СТАТУСА</b>';
        else if (eventType === 'AI_SCAN') title = '🤖 <b>СКАНИРОВАНИЕ ЧЕКА</b>';

        let text = `${title}\n\n`;
        text += `💰 Сумма: <b>${formattedAmount} ${currency}</b>\n`;
        text += `👤 Контрагент: <b>${counterparty || '---'}</b>\n`;
        text += `📝 Тип: ${type === 'expense' ? 'Расход 🔻' : type === 'income' ? 'Приход 🔺' : 'Не определено'}\n`;
        text += `📊 Статус: <b>${status?.toUpperCase()}</b>\n`;
        
        if (comment) text += `\n💬 Коммент: <i>${comment}</i>`;
        if (source) text += `\n📍 Источник: ${source}`;

        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:9002';
        text += `\n\n🔗 <a href="${baseUrl}/finance-hub">Открыть в FLOW</a>`;

        const groupsSnap = await adminDb.collection('telegram_groups')
            .where('orgId', '==', txData.orgId)
            .where('isActive', '==', true)
            .where('type', '==', 'FINANCE')
            .get();

        if (groupsSnap.empty) return;

        for (const doc of groupsSnap.docs) {
            const group = doc.data();
            // Для финансов обычно используем один чат без сложной структуры топиков, 
            // но если есть topicId в конфиге - используем.
            const topicId = group.topics?.finance || group.topics?.requests || null;
            
            await sendMessage(group.chatId, text, {
                topicId: topicId ? Number(topicId) : undefined
            });
        }
    } catch (error) {
        console.error('Finance Notification Error:', error);
    }
}
