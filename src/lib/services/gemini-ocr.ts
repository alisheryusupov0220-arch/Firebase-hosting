import { GoogleGenerativeAI } from '@google/generative-ai';
import { adminDb } from '@/firebase/server';
import { RecognizedDocument } from '@/lib/types/ai';

// Инициализация API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

/**
 * ПРЯМОЕ ИСПОЛЬЗОВАНИЕ ПАРАМЕТРИЧЕСКОЙ МОДЕЛИ ИЗ НАСТРОЕК
 */
export async function extractReceiptDataFromImage(base64Image: string, mimeType: string, orgId?: string): Promise<RecognizedDocument | null> {
    try {
        const settingsDoc = await adminDb.collection('system_settings').doc('ai_agent').get();
        const settings = settingsDoc.data();
        const modelId = settings?.model || 'gemini-2.5-flash';
        const temperature = settings?.temperature ?? 0.1;

        // --- НОВОЕ: ПОЛУЧАЕМ НАШИ ДАННЫЕ ДЛЯ КОНТЕКСТА ---
        const collectionRef = orgId 
            ? adminDb.collection(`organizations/${orgId}/my_companies`)
            : adminDb.collection('my_companies');
            
        const myCompaniesSnap = await collectionRef.get();
        const myCompaniesInfo = myCompaniesSnap.docs.map(d => {
            const data = d.data();
            return `- ${data.legalName} (ИНН: ${data.inn})`;
        }).join('\n');

        const systemPrompt = `Ты — финансовый эксперт FLOW. Твоя задача — классифицировать документ и извлечь данные в JSON.
                
                ИНФОРМАЦИЯ О НАШЕЙ КОМПАНИИ (ЭТО МЫ, FLOW):
                ${myCompaniesInfo}

                ЖЕСТКИЕ ПРАВИЛА:
                1. 'counterparty': Сюда должно попасть ТОЛЬКО название другой стороны (НЕ НАШЕЙ). Например, из поля "Поставщик" или "Продавец".
                2. 'counterpartyInn': ИНН другой стороны (НЕ НАШЕЙ).
                3. 'type': 
                   - 'expense', если наша компания является Плательщиком (Sender) или Получателем товаров (Покупателем).
                   - 'income', если наша компания является Получателем денег или Продавцом.
                4. 'senderAccount' / 'recipientAccount': Извлеки оба счета из документа.
                5. 'myAccountNumber': Номер счета, который принадлежит НАШЕЙ компании из списка выше.
                
                ТИПЫ ДОКУМЕНТОВ (doc_type):
                1. 'receipt' — платежное поручение, чек, накладная, счет-фактура (есть сумма, дата и, возможно, список товаров).
                2. 'requisites' — карточка компании, реквизиты (есть ИНН, МФО, расчетный счет).

                ИНСТРУКЦИИ ДЛЯ REQUISITES:
                - Извлеки данные той компании, которая указана в реквизитах.

                ИНСТРУКЦИИ ДЛЯ RECEIPT (НАКЛАДНЫЕ / ЧЕКИ / СЧЕТА):
                - Сумма (amount) — общая итоговая сумма документа (Итого / К оплате).
                - Название контрагента (counterparty), ИНН контрагента (counterpartyInn).
                - Список позиций/товаров (items) — извлеки все строки из таблицы товаров/услуг:
                  - name: полное название товара/услуги
                  - qty: количество (число)
                  - price: цена за единицу
                  - sum: общая сумма по данной строке (qty * price)

                ВАЖНО: Если документ - реквизиты, amount должен быть null, а items должен отсутствовать или быть пустым. 
                
                JSON:
                {
                  "doc_type": "receipt" | "requisites",
                  "counterparty": "...",
                  "counterpartyInn": "...",
                  "amount": 0,
                  "type": "expense" | "income",
                  "senderAccount": "...",
                  "recipientAccount": "...",
                  "myAccountNumber": " наш счет ",
                  "mfo": "...",
                  "bankAccount": "счет контрагента",
                  "bankName": "...",
                  "address": "...",
                  "phone": "...",
                  "items": [
                    {
                      "name": "название товара",
                      "qty": 1,
                      "price": 1000,
                      "sum": 1000
                    }
                  ]
                }`;

        const model = genAI.getGenerativeModel({
            model: modelId,
            systemInstruction: systemPrompt
        });

        const result = await model.generateContent({
            contents: [{
                role: 'user',
                parts: [{ inlineData: { data: base64Image, mimeType: mimeType } }]
            }],
            generationConfig: { temperature: temperature, responseMimeType: 'application/json' }
        });

        const response = await result.response;
        let text = response.text().trim();
        return JSON.parse(text) as RecognizedDocument;

    } catch (error: any) {
        console.error('Gemini CRITICAL ERROR:', error);
        return { error: error.message || String(error) } as any;
    }
}
