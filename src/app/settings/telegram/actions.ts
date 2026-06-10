'use server';

import * as TgBot from '@/lib/services/telegram-finance';
import { adminDb } from '@/firebase/server';

export async function setWebhookAction(url: string) {
    return await TgBot.setWebhook(url);
}

export async function getBotInfoAction() {
    return await TgBot.getMe();
}

export async function clearTelegramLogsAction() {
    const logs = await adminDb.collection('telegram_logs').get();
    const batch = adminDb.batch();
    logs.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    return { ok: true };
}
export async function testTelegramGroupAction(chatId: string, topicId?: number) {
    try {
        await TgBot.sendMessage(chatId, `🧪 <b>ТЕСТ ПОДКЛЮЧЕНИЯ</b>\n\nСистема FLOW успешно состыкована с этой группой.\nTopic ID: <code>${topicId || 'General'}</code>`, {
            topicId
        });
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}
