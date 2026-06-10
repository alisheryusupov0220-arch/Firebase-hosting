'use server';

import { extractReceiptDataFromImage as extractOCR } from "@/lib/services/gemini-ocr";
import { RecognizedDocument } from "@/lib/types/ai";

/**
 * Server Action для вызова ИИ-распознавания из клиентских компонентов
 */
export async function runReceiptOCRAction(base64: string, mimeType: string, orgId?: string): Promise<RecognizedDocument | null> {
    try {
        return await extractOCR(base64, mimeType, orgId);
    } catch (e) {
        console.error("AI OCR Action Error:", e);
        return null;
    }
}

export async function uploadSupplyImageAction(base64: string, fileName: string, mimeType: string) {
    try {
        const { uploadImageToStorage } = await import("@/lib/firebase-storage");
        return await uploadImageToStorage(base64, fileName, mimeType);
    } catch (e) {
        console.error("Upload Image Action Error:", e);
        return null;
    }
}
