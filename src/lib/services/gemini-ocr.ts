import { GoogleGenerativeAI } from '@google/generative-ai';
import { adminDb } from '@/firebase/server';
import { RecognizedDocument } from '@/lib/types/ai';

/**
 * ПРЯМОЕ ИСПОЛЬЗОВАНИЕ ПАРАМЕТРИЧЕСКОЙ МОДЕЛИ ИЗ НАСТРОЕК
 */
export async function extractReceiptDataFromImage(base64Image: string, mimeType: string, orgId?: string): Promise<RecognizedDocument | null> {
    try {
        const settingsDoc = await adminDb.collection('system_settings').doc('ai_agent').get();
        const settings = settingsDoc.data();
        const modelId = settings?.model || 'gemini-2.5-flash';
        const temperature = settings?.temperature ?? 0.1;
        const apiKey = (settings?.geminiApiKey as string || '').trim() || process.env.GEMINI_API_KEY || '';

        if (!apiKey) {
            throw new Error('Ключ Gemini API не настроен. Пожалуйста, зайдите в Настройки → Инженер промптов и укажите Ключ API.');
        }

        const genAI = new GoogleGenerativeAI(apiKey);

        // --- НОВОЕ: ПОЛУЧАЕМ НАШИ ДАННЫЕ ДЛЯ КОНТЕКСТА ---
        let orgName = '';
        if (orgId) {
            try {
                const orgDoc = await adminDb.collection('organizations').doc(orgId).get();
                if (orgDoc.exists) {
                    orgName = orgDoc.data()?.name || '';
                }
            } catch (err) {
                console.error('Failed to fetch org details for prompt:', err);
            }
        }

        const collectionRef = orgId 
            ? adminDb.collection(`organizations/${orgId}/my_companies`)
            : adminDb.collection('my_companies');
            
        const myCompaniesSnap = await collectionRef.get();
        const myCompaniesInfo = myCompaniesSnap.docs.map(d => {
            const data = d.data();
            return `- ${data.legalName} (ИНН: ${data.inn})`;
        }).join('\n');

        const systemPrompt = `Ты — финансовый эксперт FLOW. Твоя задача — классифицировать документ и извлечь данные в JSON.
                
                ИНФОРМАЦИЯ О НАШЕЙ КОМПАНИИ (ЭТО МЫ):
                Название бренда/компании в системе: ${orgName}
                Наши зарегистрированные юридические лица:
                ${myCompaniesInfo}

                ЖЕСТКИЕ ПРАВИЛА ОПРЕДЕЛЕНИЯ СТОРОН:
                1. 'counterparty': Название ДРУГОЙ стороны (НЕ нашей). Любое название, содержащее ${orgName} или наши юрлица выше, является НАШЕЙ компанией, а не контрагентом!
                   - Пример: если в накладной Получатель — "${orgName}", а Поставщик — "ООО Мечта", то контрагент — "ООО Мечта".
                2. 'counterpartyInn': ИНН другой стороны (НЕ НАШЕЙ).
                3. 'type': 
                   - 'expense', если наша компания является Получателем товаров (Покупателем) или Плательщиком.
                   - 'income', если наша компания является Продавцом или Получателем денег.
                4. 'senderAccount' / 'recipientAccount': Извлеки счета из документа.
                5. 'myAccountNumber': Номер счета нашей компании.
                
                ОПРЕДЕЛЕНИЕ ТИПА И ОПЛАТЫ ДОКУМЕНТА (ЖЕСТКОЕ ТРЕБОВАНИЕ):
                6. 'document_subtype':
                   - 'receipt', если это кассовый чек, фискальный чек, чек из супермаркета (например, Korzinka, Makro, Havas) или чек терминала (где оплата происходит моментально).
                   - 'invoice', если это товарная накладная, расходная накладная, счет-фактура или акт (где товар отпускается на склад, а оплата будет позже).
                7. 'is_paid':
                   - true, если это кассовый/фискальный чек или покупка из супермаркета (так как они всегда оплачиваются на кассе сразу).
                   - false, если это товарная накладная или счет-фактура (поставка осуществляется в долг под последующую оплату).

                ТИПЫ ДОКУМЕНТОВ (doc_type):
                1. 'receipt' — платежное поручение, чек, накладная, счет-фактура (есть сумма, дата и список товаров).
                2. 'requisites' — карточка компании, реквизиты.

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

                ВАЖНО: Если документ - реквизиты, amount должен быть null, а items должен быть пустым. 
                
                JSON:
                {
                  "doc_type": "receipt" | "requisites",
                  "document_subtype": "invoice" | "receipt",
                  "is_paid": true | false,
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
