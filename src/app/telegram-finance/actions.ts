'use server';

import { adminDb } from '@/firebase/server';
import { extractReceiptDataFromImage } from '@/lib/services/gemini-ocr';
import { RecognizedDocument } from '@/lib/types/ai';
import { revalidatePath } from 'next/cache';

export type TelegramTransaction = {
    id: string;
    telegramMessageId: number;
    telegramChatId: number | string;
    senderId: number;
    senderUsername: string;
    parsedAiData: RecognizedDocument;
    status: 'pending' | 'approved' | 'rejected';
    createdAt: { seconds: number; nanoseconds: number };
    approvedByUsername?: string;
    rejectedByUsername?: string;
};

export async function getTelegramTransactionsAction(): Promise<TelegramTransaction[]> {
    try {
        const snap = await adminDb.collection('transactions_telegram')
            .orderBy('createdAt', 'desc')
            .limit(50)
            .get();

        return snap.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                telegramMessageId: data.telegramMessageId,
                telegramChatId: data.telegramChatId,
                senderId: data.senderId,
                senderUsername: data.senderUsername,
                parsedAiData: data.parsedAiData,
                status: data.status,
                createdAt: data.createdAt,
                approvedByUsername: data.approvedByUsername,
                rejectedByUsername: data.rejectedByUsername,
            } as TelegramTransaction;
        });
    } catch (error) {
        console.error('Failed to load telegram transactions:', error);
        return [];
    }
}

export async function testReceiptAction(base64Image: string) {
    try {
        const result = await extractReceiptDataFromImage(base64Image, 'image/jpeg');
        if (result) {
            // Сохраняем тестовую транзакцию в базу для видимости
            const txDoc = adminDb.collection('transactions_telegram').doc();
            await txDoc.set({
                telegramMessageId: 0,
                telegramChatId: 'WEB_TEST',
                senderId: 0,
                senderUsername: 'Web Tester',
                parsedAiData: result,
                status: 'pending',
                createdAt: new Date()
            });
            revalidatePath('/telegram-finance');
        }
        return result;
    } catch (e) {
        console.error('OCR Test Error:', e);
        return null;
    }
}
