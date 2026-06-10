import { adminDb } from '@/firebase/server';
import { sendMessage } from './telegram-finance';

/**
 * Сервис уведомлений для закупок (Procurement) в Telegram
 */

/**
 * Уведомление о НОВОЙ заявке (тема Разбор групп)
 */
export async function notifyNewOrderRequest(orderId: string, orderData: any) {
    try {
        const items = orderData.items || [];
        const locationName = orderData.locationName || 'Объект';
        
        // 1. Проверяем настроенность ингредиентов
        const siSnap = await adminDb.collection('supplier_items').get();
        const configuredPosterIds = new Set(siSnap.docs.map(doc => doc.data().linkedPosterId));
        const readyItems = items.filter((it: any) => configuredPosterIds.has(it.posterId) || configuredPosterIds.has(it.itemId));
        const unconfiguredItems = items.filter((it: any) => !configuredPosterIds.has(it.posterId) && !configuredPosterIds.has(it.itemId));

        // 2. Формируем сообщение
        let text = `📦 <b>НОВЫЙ ЗАПРОС ПЕРСОНАЛА</b>\n`;
        text += `📍 Объект: <b>${locationName}</b>\n`;
        text += `🆔 ID: <code>${orderId.slice(-6).toUpperCase()}</code>\n\n`;

        if (readyItems.length > 0) {
            text += `✅ <b>ГОТОВЫ (${readyItems.length}):</b>\n`;
            readyItems.slice(0, 5).forEach((it: any) => text += `— ${it.name}\n`);
            if (readyItems.length > 5) text += `...и еще ${readyItems.length - 5}\n`;
            text += `\n`;
        }

        if (unconfiguredItems.length > 0) {
            text += `⚠️ <b>НЕТ ПОСТАВЩИКА (${unconfiguredItems.length}):</b>\n`;
            unconfiguredItems.forEach((it: any) => text += `— ${it.name}\n`);
            text += `\n<i>Настройте эти позиции в админке перед заказом!</i>\n\n`;
        }

        const groupsSnap = await adminDb.collection('telegram_groups')
            .where('orgId', '==', orderData.orgId)
            .where('isActive', '==', true)
            .get();

        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || '';
        const isLocal = baseUrl.includes('localhost') || !baseUrl;
        // Используем 9002 так так сервер запущен на нем
        const currentDomain = isLocal ? 'http://localhost:9002' : baseUrl;

        if (groupsSnap.empty) {
            await adminDb.collection('telegram_logs').add({
                date: new Date().toISOString(),
                event: 'PROCUREMENT_NOTIFY_FAIL',
                reason: 'No active telegram groups found at all',
                orderId
            });
            return;
        }

        // Фильтруем группы: ищем PROCUREMENT, если нет - берем все активные как fallback
        let targetGroups = groupsSnap.docs.filter(d => d.data().type === 'PROCUREMENT');
        if (targetGroups.length === 0) {
            targetGroups = groupsSnap.docs; // Fallback на все активные
        }

        for (const doc of targetGroups) {
            const group = doc.data();
            // Гарантируем, что topicId это число
            const rawTopicId = group.topics?.requests;
            const topicId = rawTopicId ? Number(rawTopicId) : null;
            
            let messageText = text;
            const finalButtons: any[][] = [
                [
                    { text: "✅ ОДОБРИТЬ", callback_data: `ordapp_${orderId}` },
                    { text: "❌ ОТКЛОНИТЬ", callback_data: `ordrej_${orderId}` }
                ]
            ];

            if (isLocal) {
                messageText += `\n\n🔗 <a href="${currentDomain}/orders/${orderId}">Открыть заявку</a>`;
            } else {
                finalButtons.push([{ text: "📂 ОТКРЫТЬ В FLOW", url: `${currentDomain}/orders/${orderId}` }]);
            }
            
            try {
                await sendMessage(group.chatId, messageText, {
                    topicId: topicId || undefined,
                    replyMarkup: {
                        inline_keyboard: finalButtons
                    }
                });
                await adminDb.collection('telegram_logs').add({
                    date: new Date().toISOString(),
                    event: 'PROCUREMENT_NOTIFY_SUCCESS',
                    chatId: group.chatId,
                    type: group.type,
                    topicId,
                    orderId
                });
            } catch (err: any) {
                await adminDb.collection('telegram_logs').add({
                    date: new Date().toISOString(),
                    event: 'PROCUREMENT_NOTIFY_ERROR',
                    error: err.message,
                    chatId: group.chatId,
                    orderId
                });
            }
        }
    } catch (error) {
        console.error('Ошибка уведомления о новой заявке:', error);
    }
}

/**
 * Уведомление о смене статуса заказа (для перехода по топикам)
 */
export async function notifyOrderStatusChange(orderId: string, orderData: any) {
    try {
        const { status, locationName, supplierName, items } = orderData;
        console.log(`🔔 NotifyOrderStatusChange: Order ${orderId}, Status: ${status}`);
        
        let text = '';
        let targetTopicKey: 'pending' | 'reception' | 'final' | 'requests' = 'requests';
        const buttons: any[] = [];
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || '';
        const isLocal = baseUrl.includes('localhost') || !baseUrl;
        const currentDomain = isLocal ? 'http://localhost:9002' : baseUrl;

        // Вычисляем задержку
        const createdDate = orderData.createdAt?.toDate ? orderData.createdAt.toDate() : new Date();
        const now = new Date();
        const diffMs = now.getTime() - createdDate.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

        if (status === 'APPROVED') {
            targetTopicKey = 'pending';
            text = `🚚 <b>ЗАКАЗ ОТПРАВЛЕН ПОСТАВЩИКУ</b>\n`;
            text += `🏢 Поставщик: <b>${supplierName || 'Не указан'}</b>\n`;
            text += `📍 Объект: ${locationName}\n`;
            text += `📋 Позиций: ${items?.length || 0}\n`;
            text += `⏱ Ожидаем подтверждения счета...\n`;
            buttons.push({ text: "✅ СЧЕТ ПОЛУЧЕН", callback_data: `ordconf_${orderId}` });
        } 
        else if (status === 'SUPPLIER_CONFIRMED') {
            targetTopicKey = 'reception';
            text = `🏁 <b>МАШИНА В ПУТИ / ПРИЕМКА</b>\n`;
            text += `🏢 Поставщик: <b>${supplierName}</b>\n`;
            text += `📍 На рампе: ${locationName}\n`;
            text += `⏳ С момента заказа прошло: <b>${diffDays}д ${diffHours}ч</b>\n\n`;
            text += `💡 <i>Кладовщик, сверь фактический вес и количество!</i>\n`;
            
            const receptionUrl = `${currentDomain}/orders/${orderId}`;
            if (!isLocal) {
                buttons.push({ text: "🚛 НАЧАТЬ ПРИЕМКУ", url: receptionUrl });
            } else {
                text += `\n🔗 <a href="${receptionUrl}">Начать приемку</a>`;
            }
        }
        else if (status === 'VERIFIED_ON_GATE') {
            targetTopicKey = 'final';
            text = `⚖️ <b>ИТОГОВОЕ ВЗВЕШИВАНИЕ И ФОТО</b>\n`;
            text += `🏢 Поставщик: <b>${supplierName}</b>\n`;
            text += `📍 Объект: ${locationName}\n`;
            text += `📸 <b>НУЖНО ФОТО НАКЛАДНОЙ</b>\n\n`;
            text += `<i>Пришлите фото накладной ответным сообщением на этот пост.</i>\n`;
        }
        else if (status === 'FINAL_WEIGHTED') {
            targetTopicKey = 'final';
            text = `📦 <b>ВЗВЕШИВАНИЕ ЗАВЕРШЕНО</b>\n`;
            text += `🏢 Поставщик: <b>${supplierName}</b>\n`;
            text += `📍 Объект: ${locationName}\n`;
            text += `⏳ Ожидаем проводку в Poster...\n`;
        }
        else if (status === 'POSTED_TO_POSTER') {
            targetTopicKey = 'final';
            text = `✅ <b>ЗАКАЗ ЗАВЕРШЕН И ВНЕСЕН В POSTER</b>\n`;
            text += `🏢 Поставщик: <b>${supplierName}</b>\n`;
            text += `📍 Объект: ${locationName}\n`;
            text += `📈 Итог: ${items?.length} поз. успешно оприходованы.\n`;
        }

        if (!text) {
            await adminDb.collection('telegram_logs').add({
                date: new Date().toISOString(),
                event: 'PROCUREMENT_NOTIFY_SKIP',
                reason: `No text mapping for status: ${status}`,
                orderId
            });
            return;
        }

        const groupsSnap = await adminDb.collection('telegram_groups')
            .where('orgId', '==', orderData.orgId)
            .where('isActive', '==', true)
            .get();

        if (groupsSnap.empty) {
             await adminDb.collection('telegram_logs').add({
                date: new Date().toISOString(),
                event: 'PROCUREMENT_NOTIFY_FAIL',
                reason: 'No active telegram groups found',
                orderId
            });
            return;
        }

        let targetGroups = groupsSnap.docs.filter(d => d.data().type === 'PROCUREMENT');
        if (targetGroups.length === 0) {
            targetGroups = groupsSnap.docs;
        }

        for (const doc of targetGroups) {
            const group = doc.data();
            const rawTopicId = (group.topics && group.topics[targetTopicKey]) || group.topics?.requests;
            const topicId = rawTopicId ? Number(rawTopicId) : null;
            
            let messageText = text;
            const finalButtons = buttons.length > 0 ? [[...buttons]] : [];

            if (isLocal && status === 'APPROVED') {
                messageText += `\n\n🔗 <a href="${currentDomain}/orders/${orderId}">Открыть заказ</a>`;
            }

            try {
                await sendMessage(group.chatId, messageText, {
                    topicId: topicId || undefined,
                    replyMarkup: finalButtons.length > 0 ? { inline_keyboard: finalButtons } : undefined
                });
                await adminDb.collection('telegram_logs').add({
                    date: new Date().toISOString(),
                    event: 'PROCUREMENT_STATUS_SUCCESS',
                    status,
                    chatId: group.chatId,
                    topicId,
                    orderId
                });
            } catch (err: any) {
                await adminDb.collection('telegram_logs').add({
                    date: new Date().toISOString(),
                    event: 'PROCUREMENT_STATUS_ERROR',
                    error: err.message,
                    status,
                    chatId: group.chatId,
                    orderId
                });
            }
        }

    } catch (error) {
        console.error('Ошибка уведомления о смене статуса:', error);
    }
}

/**
 * Уведомление об успешной приемке поставки по фото с отчетом о расхождениях
 */
export async function notifySupplyReception(orgId: string, payload: {
    supplierName: string;
    storageName: string;
    items: Array<{
        name: string;
        invoiceQty: number;
        factQty: number;
        price: number;
    }>;
    comment?: string;
    posterSupplyId?: string;
}) {
    try {
        let text = `⚖️ <b>ОТЧЕТ О ПРИЕМКЕ ПОСТАВКИ (ФАКТ)</b>\n`;
        text += `🏢 Поставщик: <b>${payload.supplierName}</b>\n`;
        text += `📍 Склад/Объект: <b>${payload.storageName}</b>\n`;
        if (payload.posterSupplyId) {
            text += `🆔 Poster ID: <code>${payload.posterSupplyId}</code>\n`;
        }
        text += `\n📋 <b>СВЕРКА КОЛИЧЕСТВА:</b>\n`;

        let hasDiscrepancies = false;
        payload.items.forEach(it => {
            const diff = it.factQty - it.invoiceQty;
            const diffText = diff === 0 ? '✅ (ОК)' : diff > 0 ? `⚠️ (+${diff})` : `🚨 (${diff})`;
            if (diff !== 0) hasDiscrepancies = true;
            text += `— <b>${it.name}</b>:\n  • Факт: <code>${it.factQty}</code> (Накладная: ${it.invoiceQty}) ${diffText}\n`;
        });

        if (hasDiscrepancies) {
            text += `\n⚠️ <b>ВНИМАНИЕ: Обнаружены расхождения с накладной!</b>\n`;
        } else {
            text += `\n✅ Приемка прошла успешно без расхождений.\n`;
        }

        if (payload.comment) {
            text += `\n💬 Комментарий: <i>${payload.comment}</i>`;
        }

        const groupsSnap = await adminDb.collection('telegram_groups')
            .where('orgId', '==', orgId)
            .where('isActive', '==', true)
            .get();

        if (groupsSnap.empty) return;

        // Отправляем во все группы этого бренда, которые настроены на PROCUREMENT или FINANCE
        for (const doc of groupsSnap.docs) {
            const group = doc.data();
            const topicId = group.topics?.reception || group.topics?.requests || null;
            
            await sendMessage(group.chatId, text, {
                topicId: topicId ? Number(topicId) : undefined
            });
        }
    } catch (error) {
        console.error('Ошибка отправки уведомления о приемке:', error);
    }
}
