import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/firebase/server';
import { extractReceiptDataFromImage } from '@/lib/services/gemini-ocr';
import * as TgBot from '@/lib/services/telegram-finance';
import { uploadImageToStorage } from '@/lib/firebase-storage';
import { FieldValue } from 'firebase-admin/firestore';
import { updateOrderAction } from '@/app/orders/actions';
import { updateTransactionStatusAction } from '@/app/finance-hub/actions';

export async function POST(req: NextRequest) {
    try {
        const update = await req.json();
        
        // 1. Логирование
        try {
            const logEntry = {
                id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
                updateType: update.callback_query ? 'callback' : update.message ? (update.message.photo ? 'photo' : 'text') : 'other',
                chatId: update.message?.chat?.id || update.callback_query?.message?.chat?.id || null,
                chatTitle: update.message?.chat?.title || update.callback_query?.message?.chat?.title || 'Private',
                sender: update.message?.from?.username || update.message?.from?.first_name || update.callback_query?.from?.username || 'Unknown',
                preview: update.message?.text || (update.message?.photo ? '[Фото/Скан]' : update.callback_query?.data ? `Кнопка: ${update.callback_query.data}` : 'Update'),
                raw: update,
                createdAt: FieldValue.serverTimestamp()
            };
            await adminDb.collection('telegram_logs').doc(logEntry.id).set(logEntry);
        } catch (e) {
            console.error('Failed to save log:', e);
        }

        if (update.callback_query) {
            return await handleCallbackQuery(update.callback_query);
        }

        if (update.message) {
            return await handleNewMessage(update.message);
        }

        return NextResponse.json({ ok: true });

    } catch (err: any) {
        console.error('Webhook Global Error:', err);
        return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
    }
}

async function handleCallbackQuery(callbackQuery: any) {
    const cbId = callbackQuery.id;
    const cbData = callbackQuery.data; 
    const chatId = callbackQuery.message.chat.id;
    const messageId = callbackQuery.message.message_id;
    const user = callbackQuery.from;

    if (!cbData) return NextResponse.json({ ok: true });

    const [action, targetId] = cbData.split('_');
    if (!targetId) return NextResponse.json({ ok: true });

    // ОПРЕДЕЛЯЕМ КОЛЛЕКЦИЮ: ord... - это Заказы, остальные - Финансы
    const collectionName = action.startsWith('ord') ? 'order_requests' : 'finance_transactions';
    const { FieldPath } = require('firebase-admin/firestore');
    const snap = await adminDb.collectionGroup(collectionName)
        .where(FieldPath.documentId(), '==', targetId)
        .limit(1)
        .get();

    if (snap.empty) {
        await TgBot.answerCallbackQuery(cbId, `Запись не найдена в ${collectionName}!`, true);
        return NextResponse.json({ ok: true });
    }

    const docSnap = snap.docs[0];
    const docRef = docSnap.ref;
    const docData = docSnap.data();
    
    let orgId = docData.orgId;
    if (!orgId) {
        // Resolve orgId from the group associated with this chatId
        const groupSnap = await adminDb.collection('telegram_groups').where('isActive', '==', true).get();
        const groupDoc = groupSnap.docs.find(doc => {
            const sId = String(doc.data().chatId);
            return sId === String(chatId) || sId === String(chatId).replace('-100','') || ('-100'+sId) === String(chatId);
        });
        if (groupDoc) {
            orgId = groupDoc.data().orgId;
        }
    }

    if (!orgId) {
        await TgBot.answerCallbackQuery(cbId, `❌ Ошибка: Не удалось определить бренд/организацию для этой записи.`, true);
        return NextResponse.json({ ok: true });
    }

    if (action === 'approve') {
        const result = await updateTransactionStatusAction(orgId, targetId, 'completed', `TG: @${user.username || user.first_name}`, 'telegram_bot');
        if (result.success) {
            await TgBot.answerCallbackQuery(cbId, `✅ Проведено! Баланс обновлен.`);
            await TgBot.editMessageText(chatId, messageId, `${callbackQuery.message.text}\n\n<b>✅ ПРОВЕДЕНО: @${user.username || user.first_name}</b>`);
        } else {
            await TgBot.answerCallbackQuery(cbId, `❌ Ошибка: ${result.error}`, true);
        }
    } else if (action === 'reject') {
        await updateTransactionStatusAction(orgId, targetId, 'rejected', `TG: @${user.username || user.first_name}`, 'telegram_bot');
        await TgBot.answerCallbackQuery(cbId, `❌ Отклонено`);
        await TgBot.editMessageText(chatId, messageId, `${callbackQuery.message.text}\n\n<b>❌ ОТКЛОНЕНО: @${user.username || user.first_name}</b>`);
    } else if (action === 'register') {
        const txData = docSnap.data();
        const raw = txData?.metadata?.rawAiData;
        const inn = String(raw?.counterpartyInn || '').trim();
        const name = String(raw?.counterparty || 'Новый контрагент').toUpperCase().trim();

        // 1. Проверка на дубликаты по ИНН (если ИНН есть)
        if (inn) {
            const existing = await adminDb.collection(`organizations/${orgId}/contractors`).where('inn', '==', inn).get();
            if (!existing.empty) {
                const doc = existing.docs[0].data();
                await TgBot.answerCallbackQuery(cbId, `⚠️ Контрагент уже существует!`, true);
                await TgBot.editMessageText(chatId, messageId, `⚠️ <b>Контрагент с ИНН ${inn} уже есть в базе:</b>\n\n<b>${doc.name}</b>\n\nДубликат не создан.`);
                await docRef.delete(); // Удаляем временную запись (draft)
                return NextResponse.json({ ok: true });
            }
        }

        // 2. Создание нового контрагента
        const cRef = adminDb.collection(`organizations/${orgId}/contractors`).doc();
        await cRef.set({
            id: cRef.id,
            name: name,
            inn: inn,
            bankCode: String(raw?.mfo || '').trim(),
            bankAccount: String(raw?.bankAccount || '').replace(/\s/g, ''),
            bankName: String(raw?.bankName || '').trim(),
            address: String(raw?.address || '').trim(),
            phone: String(raw?.phone || '').trim(),
            balance: 0,
            type: 'supplier',
            isActive: true,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp()
        });
        
        // 3. Очистка: удаляем временный документ 'draft' из транзакций
        await docRef.delete();
        
        await TgBot.answerCallbackQuery(cbId, `✅ Контрагент зарегистрирован!`);
        await TgBot.editMessageText(chatId, messageId, `🏢 <b>Компания успешно добавлена в FLOW:</b>\n\n${name}\nИНН: ${inn}\n\nТеперь вы можете принимать платежи от этого контрагента.`);
    } else if (action === 'edit') {
        await TgBot.sendMessage(chatId, `Напишите ответным сообщением: <b>Сумма Пробел Название</b>`, { replyMarkup: { force_reply: true } });
    } else if (action === 'ordapp') {
        // Одобрение заказа
        const result = await updateOrderAction(targetId, { status: 'APPROVED' }, `TG: @${user.username || user.first_name}`, orgId);
        if (result.success) {
            await TgBot.answerCallbackQuery(cbId, `✅ Заявка одобрена!`);
            await TgBot.editMessageText(chatId, messageId, `${callbackQuery.message.text}\n\n<b>✅ ОДОБРЕНО (Менеджер): @${user.username || user.first_name}</b>`);
        } else {
            await TgBot.answerCallbackQuery(cbId, `❌ Ошибка: ${result.error}`, true);
        }
    } else if (action === 'ordrej') {
        // Отклонение заказа
        const result = await updateOrderAction(targetId, { status: 'DRAFT' }, `TG: @${user.username || user.first_name}`, orgId);
        if (result.success) {
            await TgBot.answerCallbackQuery(cbId, `❌ Отклонено`);
            await TgBot.editMessageText(chatId, messageId, `${callbackQuery.message.text}\n\n<b>❌ ОТКЛОНЕНО: @${user.username || user.first_name}</b>`);
        }
    } else if (action === 'ordconf') {
        // Подтверждение счета от поставщика
        const result = await updateOrderAction(targetId, { status: 'SUPPLIER_CONFIRMED' }, `TG: @${user.username || user.first_name}`, orgId);
        if (result.success) {
            await TgBot.answerCallbackQuery(cbId, `🧾 Счет подтвержден! Перенос в зону Приемки...`);
            await TgBot.editMessageText(chatId, messageId, `${callbackQuery.message.text}\n\n<b>🧾 СЧЕТ ПОЛУЧЕН: @${user.username || user.first_name}</b>`);
        }
    }

    return NextResponse.json({ ok: true });
}

async function handleNewMessage(message: any) {
    const chatId = message.chat.id;
    
    // 1. ОБРАБОТКА REPLY (РЕДАКТИРОВАНИЕ)
    if (message.reply_to_message && message.text) {
        const parts = message.text.split(' ');
        const newAmount = parseFloat(parts[0]);
        const newName = parts.slice(1).join(' ');

        if (!isNaN(newAmount) && newName) {
            const lastTx = await adminDb.collectionGroup('finance_transactions').where('metadata.telegramChatId', '==', chatId).where('status', '==', 'pending').limit(1).get();
            if (!lastTx.empty) {
                await lastTx.docs[0].ref.update({ amount: newAmount, counterparty: newName });
                await TgBot.sendMessage(chatId, `✅ Данные обновлены!`);
                return NextResponse.json({ ok: true });
            }
        }
    }

    // 2. АВТОРИЗАЦИЯ
    const groupSnap = await adminDb.collection('telegram_groups').where('isActive', '==', true).get();
    const groupDoc = groupSnap.docs.find(doc => {
        const sId = String(doc.data().chatId);
        return sId === String(chatId) || sId === String(chatId).replace('-100','') || ('-100'+sId) === String(chatId);
    });
    if (!groupDoc) return NextResponse.json({ ok: true });
    
    const groupData = groupDoc.data();
    const orgId = groupData.orgId;
    if (!orgId) {
        console.error(`[Telegram Webhook] Group ${groupDoc.id} is missing orgId.`);
        return NextResponse.json({ ok: true });
    }
    const defaultCompanyId = groupData.defaultCompanyId || null;
    const defaultAccountId = groupData.defaultAccountId || null;

    // 3. ПОЛУЧЕНИЕ ФОТО
    let fileId = null;
    if (message.photo) fileId = message.photo[message.photo.length - 1].file_id;
    else if (message.document?.mime_type?.includes('image')) fileId = message.document.file_id;
    if (!fileId) return NextResponse.json({ ok: true });

    // 4. ИИ РАСПОЗНАВАНИЕ + ЗАГРУЗКА В ХРАНИЛИЩЕ
    const downUrl = await TgBot.getFileDownloadUrl(fileId);
    if (!downUrl) return NextResponse.json({ ok: true });
    
    const b64 = await TgBot.downloadFileAsBase64(downUrl);
    if (!b64) return NextResponse.json({ ok: true });

    // Сохраняем оригинал в Storage (это наш "цифровой след")
    const fileName = `tg_${Date.now()}_${Math.random().toString(36).slice(2, 5)}.jpg`;
    const storageResult = await uploadImageToStorage(b64, fileName);
    const evidenceUrl = storageResult?.url || null;

    const parsed = await extractReceiptDataFromImage(b64, 'image/jpeg', orgId);
    if (!parsed) return NextResponse.json({ ok: true });

    // --- СЦЕНАРИЙ А: РЕГИСТРАЦИЯ ---
    if (parsed.doc_type === 'requisites') {
        const txRef = adminDb.collection(`organizations/${orgId}/finance_transactions`).doc();
        // Сохраняем как черновик (draft) для последующей регистрации по кнопке
        await txRef.set({ 
            id: txRef.id,
            orgId,
            status: 'draft', 
            amount: 0, // Принудительно 0, чтобы не влияло на балансы
            counterparty: parsed.counterparty,
            myCompanyId: defaultCompanyId,
            receiptImageUrl: evidenceUrl, // Привязываем фото к черновику
            metadata: { 
                rawAiData: parsed, 
                telegramChatId: chatId,
                docType: 'requisites'
            }, 
            createdAt: FieldValue.serverTimestamp() 
        });
        const msg = `🏢 <b>Обнаружены реквизиты</b>\n\n<b>Компания:</b> ${parsed.counterparty}\n<b>ИНН:</b> ${parsed.counterpartyInn}\n<b>Р/с:</b> ${parsed.bankAccount}\n\nЗарегистрировать в FLOW?`;
        const kb = { inline_keyboard: [[ { text: "✅ ЗАРЕГИСТРИРОВАТЬ", callback_data: `register_${txRef.id}` }, { text: "❌ ОТМЕНА", callback_data: `reject_${txRef.id}` } ]] };
        await TgBot.sendMessage(chatId, msg, { replyMarkup: kb });
        return NextResponse.json({ ok: true });
    }

    // --- СЦЕНАРИЙ Б: ПЛАТЕЖКА ---
    // Умный поиск нашего счета (проверяем все поля, полученные от ИИ)
    const possibleAccounts = [
        String(parsed.myAccountNumber || '').trim(),
        String(parsed.senderAccount || '').trim(),
        String(parsed.recipientAccount || '').trim()
    ].filter(a => a && a.length > 5);

    let accDoc: any = null;
    let myAcc: any = null;

    if (possibleAccounts.length > 0) {
        const accSnap = await adminDb.collection(`organizations/${orgId}/bank_accounts`)
            .where('accountNumber', 'in', possibleAccounts)
            .limit(1).get();
        
        if (!accSnap.empty) {
            accDoc = accSnap.docs[0];
            myAcc = accDoc.data();
        }
    }

    // Если счет не найден в документе по номеру счета, проверяем дефолтный счет группы
    if (!myAcc && defaultAccountId) {
        const accSnap = await adminDb.doc(`organizations/${orgId}/bank_accounts/${defaultAccountId}`).get();
        if (accSnap.exists) {
            accDoc = accSnap;
            myAcc = accSnap.data();
        }
    }

    // Если всё еще не найден счет, берем первый попавшийся в этой организации
    if (!myAcc) {
        const defaultAccSnap = await adminDb.collection(`organizations/${orgId}/bank_accounts`).limit(1).get();
        if (!defaultAccSnap.empty) {
            accDoc = defaultAccSnap.docs[0];
            myAcc = accDoc.data();
            await TgBot.sendMessage(chatId, `⚠️ <b>ВНИМАНИЕ:</b> Счет из документа не распознан. Операция будет привязана к: <code>${myAcc.accountNumber}</code> (${myAcc.bankName || myAcc.name})`);
        } else {
            await TgBot.sendMessage(chatId, `❌ <b>ОШИБКА:</b> В FLOW не зарегистрировано ни одного счета. Добавьте счет в разделе "Банки и Счета".`);
            return NextResponse.json({ ok: true });
        }
    }

    // Ищем контрагента
    const cSnap = await adminDb.collection(`organizations/${orgId}/contractors`).where('inn', '==', parsed.counterpartyInn).limit(1).get();
    const contractor = cSnap.empty ? null : cSnap.docs[0].data();

    const txRef = adminDb.collection(`organizations/${orgId}/finance_transactions`).doc();
    await txRef.set({
        id: txRef.id,
        orgId,
        status: 'pending',
        type: parsed.type || 'expense',
        amount: parsed.amount || 0,
        currency: parsed.currency || 'UZS',
        counterparty: parsed.counterparty,
        counterpartyInn: parsed.counterpartyInn,
        contractorId: contractor ? contractor.id : null,
        myAccountId: accDoc.id,
        myCompanyId: myAcc?.companyId || defaultCompanyId || null,
        receiptImageUrl: evidenceUrl, // Привязываем фото к транзакции
        metadata: { telegramChatId: chatId, rawAiData: parsed },
        createdAt: FieldValue.serverTimestamp()
    });

    const infoMsg = `🛡 <b>FLOW Guard</b>\n\n🏦 <b>Счет:</b> ${myAcc.bankName || myAcc.name}\n💰 <b>Сумма:</b> ${(parsed.amount||0).toLocaleString()} UZS\n🏢 <b>Контрагент:</b> ${parsed.counterparty}\n\n${contractor ? '✅ Контрагент подтвержден' : '❌ <b>ОШИБКА: Фирма не зарегистрирована!</b>\nСначала пришлите реквизиты.'}`;
    const kb = { inline_keyboard: [[ { text: "✅ ПРОВЕСТИ", callback_data: contractor ? `approve_${txRef.id}` : `ignore` }, { text: "❌ ОТМЕНА", callback_data: `reject_${txRef.id}` } ]] };
    await TgBot.sendMessage(chatId, infoMsg, { replyMarkup: kb });
    
    return NextResponse.json({ ok: true });
}
