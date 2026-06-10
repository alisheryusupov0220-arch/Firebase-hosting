'use server';

import { GoogleGenerativeAI } from "@google/generative-ai";
import { adminDb } from "@/firebase/server"; // Импорт серверной базы для чтения промпта из коллекции ai_prompts

/**
 * AI OCR: Сканирование реквизитов Контрагента с использованием ТВОЕГО ПРОМПТА ИЗ БАЗЫ
 */
export async function scanContractorInvoiceAction(base64Image: string) {
    try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) return { success: false, error: 'API КЛЮЧ НЕ НАЙДЕН' };

        // 1. ДОСТАЕМ ТВОЙ ПРОМПТ ИЗ НАСТРОЕК (Firestore: ai_prompts/contractor_ocr)
        let customPrompt = "";
        try {
            const promptDoc = await adminDb.collection('ai_prompts').doc('contractor_ocr').get();
            customPrompt = promptDoc.exists ? promptDoc.data()?.text : "";
        } catch(e) { console.warn('Custom prompt not found, using default'); }

        // ДЕФОЛТНЫЙ ПРОМПТ (если ты еще не задал свой в настройках)
        const defaultPrompt = `
            Analyze this bank document / contractor details screenshot.
            Return ONLY a valid JSON object with the following fields (if not found, use empty string):
            {
                "name": "Full legal name (e.g., OOO MISSION FOODS)",
                "inn": "Tax ID (INN) - 9 or 10 digits",
                "bankAccount": "Bank Account Number (20 digits ONLY, remove spaces)",
                "bankCode": "Bank MFO (5 digits)",
                "bankName": "Bank Name",
                "phone": "Phone number if any"
            }
            CRITICAL: Return ONLY JSON. No markdown. No comments.
        `;

        const finalPrompt = customPrompt || defaultPrompt;

        // 2. ЗАПУСКАЕМ GEMINI 2.5 FLASH (Синхронизировано с Хабом)
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ 
            model: 'gemini-2.5-flash' 
        });

        const result = await model.generateContent({
            contents: [{
                role: 'user',
                parts: [
                    { text: finalPrompt },
                    { inlineData: { data: base64Image.split(',')[1], mimeType: 'image/png' } }
                ]
            }],
            generationConfig: { responseMimeType: 'application/json', temperature: 0.1 }
        });

        let responseText = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
        const jsonStart = responseText.indexOf('{');
        const jsonEnd = responseText.lastIndexOf('}') + 1;
        
        if (jsonStart !== -1 && jsonEnd !== -1) {
            const rawJson = responseText.substring(jsonStart, jsonEnd);
            const data = JSON.parse(rawJson);

            // ФИНАЛЬНАЯ ЧИСТКА ЦИФР
            return { 
                success: true, 
                data: {
                    name: (data.name || '').toUpperCase().trim(),
                    inn: (data.inn || '').replace(/\D/g, '').trim(),
                    bankAccount: (data.bankAccount || '').replace(/\D/g, '').trim(),
                    bankCode: (data.bankCode || '').replace(/\D/g, '').trim(),
                    bankName: (data.bankName || '').trim(),
                    phone: (data.phone || '').trim()
                }
            };
        }

        return { success: false, error: 'ИИ не распознал структуру JSON' };
    } catch (error: any) {
        console.error('OCR CRITICAL ERROR:', error);
        return { success: false, error: error.message || 'Ошибка обработки' };
    }
}
