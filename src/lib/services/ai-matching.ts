import { GoogleGenerativeAI } from '@google/generative-ai';
import { ERPItem } from '@/lib/types/erp';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export interface MatchResult {
    scannedName: string;
    matchedItemId: string | null;
    confidence: number; // 0-1
    isNew: boolean;
    suggestedName?: string;
}

/**
 * ИИ-сервис для сопоставления названий из накладных с нашей номенклатурой
 */
export async function matchScannedItemsToERP(
    scannedItems: { name: string; qty?: number; price?: number }[],
    internalItems: ERPItem[]
): Promise<MatchResult[]> {
    try {
        const modelId = 'gemini-2.5-flash'; // Используем flash для скорости
        const model = genAI.getGenerativeModel({ model: modelId });

        const internalNames = internalItems.map(i => ({ id: i.id, name: i.name }));
        
        const systemPrompt = `Ты — эксперт по складскому учету в ресторане. 
        Твоя задача: сопоставить названия товаров из накладной поставщика с нашими внутренними названиями.
        
        ВХОДНЫЕ ДАННЫЕ:
        1. Список названий из накладной.
        2. Список наших внутренних названий (ID и Name).
        
        ИНСТРУКЦИИ:
        - Для каждого названия из накладной найди наиболее подходящее из нашего списка.
        - Если товары идентичны (например, "Молоко 3.2% 1л" и "Молоко 3.2%"), сопоставляй.
        - Если в нашем списке НЕТ похожих товаров, поставь matchedItemId = null и confidence = 0.
        - Верни JSON массив объектов: { "scannedName": "...", "matchedItemId": "id_или_null", "confidence": 0.9 }
        
        НИКОГДА не выдумывай соответствия, если их нет. Лучше null.
        `;

        const userPrompt = `
        НАШИ ТОВАРЫ: ${JSON.stringify(internalNames)}
        ТОВАРЫ ИЗ НАКЛАДНОЙ: ${JSON.stringify(scannedItems.map(s => s.name))}
        `;

        const result = await model.generateContent([systemPrompt, userPrompt]);
        const response = await result.response;
        let text = response.text().trim();
        text = text.replace(/```json/g, '').replace(/```/g, '').trim();

        return JSON.parse(text) as MatchResult[];
    } catch (error) {
        console.error('AI Matching Error:', error);
        return scannedItems.map(s => ({ scannedName: s.name, matchedItemId: null, confidence: 0, isNew: true }));
    }
}
