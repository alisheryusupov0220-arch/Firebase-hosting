'use server';

import { adminDb } from '@/firebase/server';
import { AISystemSettings } from '@/lib/types/settings';
import { revalidatePath } from 'next/cache';
import { FieldValue } from 'firebase-admin/firestore';

const DEFAULT_PROMPT = `Ты — финансовый ассистент FLOW. Твоя задача — распознавать денежные операции из чеков, платежных поручений и банковских выписок.

ИНСТРУКЦИИ:
1. ЦЕЛЬ: Определить изменение баланса (ПРИХОД или РАСХОД), КТО контрагент и СУММУ.
2. КОНТРАГЕНТ: Это самое важное. Найди название фирмы или имя получателя/отправителя. 
3. РЕКВИЗИТЫ: Если есть ИНН или расчетный счет — запиши. Если нет — просто оставь пустыми. Не выдумывай.
4. ТИП ОПЕРАЦИИ: 
   - 'expense' (Расход) — если мы платим кому-то.
   - 'income' (Приход) — если кто-то платит нам или это возврат.
5. СТРУКТУРА ОТВЕТА (JSON):
   {
     "doc_type": "название вида документа",
     "type": "income" | "expense",
     "counterparty": "Название фирмы",
     "counterpartyInn": "ИНН если есть",
     "amount": 1234.56,
     "currency": "UZS",
     "date": "ГГГГ-ММ-ДД",
     "comment": "краткое назначение платежа"
   }

ОШИБКИ: 
Если на фото НЕ финансовый документ (например, просто меню, лицо человека, пейзаж или накладная без суммы оплаты):
Верни: {"error": "not_a_financial_doc", "comment": "Коротко опиши что на фото (напр: 'Это меню ресторана')"} `;

export async function getAISettingsAction(): Promise<AISystemSettings> {
    const doc = await adminDb.collection('system_settings').doc('ai_agent').get();
    
    if (!doc.exists) {
        return {
            id: 'ai_agent',
            systemPrompt: DEFAULT_PROMPT,
            model: 'gemini-2.5-flash',
            temperature: 0.1,
            updatedAt: new Date()
        };
    }

    const data = doc.data() as any;
    return {
        id: 'ai_agent',
        systemPrompt: data.systemPrompt || DEFAULT_PROMPT,
        model: data.model || 'gemini-2.5-flash',
        temperature: data.temperature ?? 0.1,
        updatedAt: data.updatedAt?.toDate() || new Date()
    } as AISystemSettings;
}

export async function updateAISettingsAction(payload: Partial<AISystemSettings>) {
    try {
        await adminDb.collection('system_settings').doc('ai_agent').set({
            ...payload,
            updatedAt: FieldValue.serverTimestamp()
        }, { merge: true });
        
        revalidatePath('/settings/ai');
        return { success: true };
    } catch (e) {
        console.error('Failed to update AI settings:', e);
        return { success: false };
    }
}
