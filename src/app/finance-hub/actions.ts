'use server';

import { adminDb } from '@/firebase/server';
import { FinanceTransaction } from '@/lib/types/finance';
import { extractReceiptDataFromImage } from '@/lib/services/gemini-ocr';
import { revalidatePath } from 'next/cache';

function safeRevalidatePath(path: string) {
    try {
        revalidatePath(path);
    } catch (e) {
        console.warn(`[revalidatePath] failed for ${path} (safe to ignore):`, e);
    }
}
import { FieldValue } from 'firebase-admin/firestore';
import { uploadImageToStorage } from '@/lib/firebase-storage';
import { notifyFinanceTransaction } from '@/lib/services/telegram-finance-notify';
import { orgCol, orgDoc } from '@/lib/db-paths';

/**
 * Получить последние транзакции (org-scoped)
 */
export async function getTransactionsAction(orgId: string, limit = 50): Promise<FinanceTransaction[]> {
    if (!orgId) return [];
    try {
        const snap = await adminDb.collection(orgCol(orgId).financeTransactions)
            .orderBy('createdAt', 'desc')
            .limit(limit)
            .get();

        const filteredDocs = snap.docs.filter(doc => {
            const status = doc.data().status;
            return ['pending', 'completed', 'rejected', 'archived'].includes(status);
        });

        return filteredDocs.map(doc => {
            const data = doc.data();
            const sanitizedHistory = (data.metadata?.history || []).map((h: any) => ({
                ...h,
                date: h.date?.seconds ? h.date.seconds * 1000 :
                      h.date instanceof Date ? h.date.getTime() : h.date
            }));
            return {
                id: doc.id,
                ...data,
                createdAt: data.createdAt ? {
                    seconds: data.createdAt.seconds,
                    nanoseconds: data.createdAt.nanoseconds
                } : null,
                updatedAt: data.updatedAt ? {
                    seconds: data.updatedAt.seconds,
                    nanoseconds: data.updatedAt.nanoseconds
                } : null,
                metadata: { ...data.metadata, history: sanitizedHistory }
            } as FinanceTransaction;
        });
    } catch (error) {
        console.error('FinanceHub: Load Failed:', error);
        return [];
    }
}

/**
 * OCR-скан чека (org-scoped)
 */
export async function testReceiptFinanceAction(base64Image: string, orgId: string) {
    if (!orgId) return null;
    try {
        const result = await extractReceiptDataFromImage(base64Image, 'image/jpeg', orgId);
        if (!result) return null;

        const amount = result.amount || result.amounts?.total || 0;
        const targetInn = result.counterpartyInn || '';
        const targetName = result.counterparty || 'Неизвестно';
        const docDate = result.date || '';
        const docId = result.document_id || '';

        const fileName = `web_${Date.now()}.jpg`;
        const storageResult = await uploadImageToStorage(base64Image, fileName);

        // Детекция дубликатов
        if (docId) {
            const idSnap = await adminDb.collection(orgCol(orgId).financeTransactions)
                .where('documentId', '==', docId).limit(1).get();
            if (!idSnap.empty) {
                return { ...result, duplicateId: idSnap.docs[0].id, isDuplicate: true, duplicateReason: 'id' };
            }
        }

        const txDoc = adminDb.collection(orgCol(orgId).financeTransactions).doc();

        let contractorId = null;
        let myAccountId = null;
        const isInvoice = ['Счет', 'УПД', 'Товарная накладная', 'Инвойс', 'Платежное поручение'].includes(result.doc_type);

        if (result.myAccountNumber) {
            const accSnap = await adminDb.collection(orgCol(orgId).bankAccounts)
                .where('accountNumber', '==', String(result.myAccountNumber).trim())
                .limit(1).get();
            if (!accSnap.empty) myAccountId = accSnap.docs[0].id;
        }

        if (targetInn || targetName) {
            if (targetInn) {
                const cSnap = await adminDb.collection(orgCol(orgId).contractors)
                    .where('inn', '==', targetInn).limit(1).get();
                if (!cSnap.empty) contractorId = cSnap.docs[0].id;
            }
            if (!contractorId && targetName !== 'Неизвестно') {
                const cSnap = await adminDb.collection(orgCol(orgId).contractors)
                    .where('name', '==', targetName.toUpperCase()).limit(1).get();
                if (!cSnap.empty) contractorId = cSnap.docs[0].id;
            }
        }

        const txData: any = {
            type: result.type || (isInvoice ? 'expense' : 'unknown'),
            status: result.error ? 'rejected' : 'pending',
            source: 'ai_scan_v3',
            amount,
            orgId,
            currency: result.currency || result.amounts?.currency || 'UZS',
            counterparty: targetName,
            counterpartyInn: targetInn,
            documentId: docId,
            date: docDate,
            comment: result.comment,
            isInvoice,
            contractorId,
            myAccountId,
            receiptImageUrl: storageResult?.url || null,
            receiptStoragePath: storageResult?.storagePath || null,
            metadata: {
                docType: result.doc_type || null,
                documentId: docId,
                items: result.items || null,
                rawAiData: result || null,
                senderUsername: 'Web Tester V3',
                aiError: result.error || null,
                aiComment: result.comment || null,
            },
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        };

        await txDoc.set(txData);
        await notifyFinanceTransaction(txDoc.id, txData, 'AI_SCAN');
        safeRevalidatePath('/finance-hub');
        safeRevalidatePath('/finance-hub/accounts');
        return result;
    } catch (e) {
        console.error('FinanceHub Action Error:', e);
        return null;
    }
}

export async function updateTransactionStatusAction(
    orgId: string,
    id: string,
    status: FinanceTransaction['status'],
    userName: string,
    userId: string = 'system',
    myAccountId?: string
) {
    if (!orgId) return { success: false, error: 'orgId required' };
    try {
        const txRef = adminDb.doc(orgDoc(orgId).financeTransaction(id));
        const txSnap = await txRef.get();
        if (!txSnap.exists) return { success: false, error: 'Транзакция не найдена' };

        const txData = txSnap.data() as FinanceTransaction;
        const oldStatus = txData.status;
        if (oldStatus === status) return { success: true };

        const amount = Number(txData.amount || 0);
        const isExpense = txData.type === 'expense';
        const isIncome = txData.type === 'income';
        const targetAccountId = myAccountId || txData.myAccountId;

        let accountRef: any = null;
        let accountBalance = 0;
        if (targetAccountId) {
            accountRef = adminDb.doc(orgDoc(orgId).bankAccount(targetAccountId));
            const accSnap = await accountRef.get();
            if (accSnap.exists) accountBalance = Number(accSnap.data()?.balance || 0);
        }

        let contractorRef: any = null;
        let contractorBalance = 0;
        if (txData.contractorId) {
            contractorRef = adminDb.doc(orgDoc(orgId).contractor(txData.contractorId));
            const cSnap = await contractorRef.get();
            if (cSnap.exists) contractorBalance = Number(cSnap.data()?.balance || 0);
        }

        const historyEntry = {
            date: new Date(), userId, userName,
            action: 'status_change',
            changes: { status: { old: oldStatus, new: status } }
        };

        const update: any = {
            status,
            updatedAt: FieldValue.serverTimestamp(),
            myAccountId: targetAccountId || null,
            contractorId: contractorRef?.id || txData.contractorId || null,
            'metadata.history': [...(txData.metadata?.history || []), historyEntry]
        };

        if (oldStatus === 'completed' && status !== 'completed') {
            if (accountRef) update['bankAccountBalance'] = isExpense ? accountBalance + amount : isIncome ? accountBalance - amount : accountBalance;
            if (contractorRef) update['contractorBalance'] = isExpense ? contractorBalance - amount : isIncome ? contractorBalance + amount : contractorBalance;
        }
        if (status === 'completed' && oldStatus !== 'completed') {
            if (accountRef) update['bankAccountBalance'] = isExpense ? accountBalance - amount : isIncome ? accountBalance + amount : accountBalance;
            if (contractorRef) update['contractorBalance'] = isExpense ? contractorBalance + amount : isIncome ? contractorBalance - amount : contractorBalance;
            update['metadata.approvedBy'] = userName;
        }
        if (status === 'rejected') update['metadata.rejectedBy'] = userName;

        const bankBalance = update['bankAccountBalance'];
        const cBal = update['contractorBalance'];
        delete update['bankAccountBalance'];
        delete update['contractorBalance'];

        await txRef.update(update);
        if (bankBalance !== undefined && accountRef) await accountRef.update({ balance: bankBalance });
        if (cBal !== undefined && contractorRef) await contractorRef.update({ balance: cBal });

        safeRevalidatePath('/finance-hub');
        safeRevalidatePath('/finance-hub/accounts');

        const finalSnap = await txRef.get();
        await notifyFinanceTransaction(id, finalSnap.data(), 'STATUS_CHANGE');
        return { success: true };
    } catch (error) {
        console.error('FinanceHub: Status Update Failed:', error);
        return { success: false, error: String(error) };
    }
}

export async function createTransactionAction(
    orgId: string,
    payload: Partial<FinanceTransaction>,
    userName: string = 'Admin',
    userId: string = 'system'
) {
    if (!orgId) return { success: false, error: 'orgId required' };
    try {
        const txDoc = adminDb.collection(orgCol(orgId).financeTransactions).doc();
        const status = payload.status || 'completed';
        const amount = Number(payload.amount || 0);
        const isExpense = payload.type === 'expense';
        const isIncome = payload.type === 'income';

        let accountRef: any = null;
        let accountBalance = 0;
        if (payload.myAccountId) {
            accountRef = adminDb.doc(orgDoc(orgId).bankAccount(payload.myAccountId));
            const accSnap = await accountRef.get();
            if (accSnap.exists) accountBalance = Number(accSnap.data()?.balance || 0);
        }

        let contractorRef: any = null;
        let contractorBalance = 0;
        if (payload.contractorId) {
            contractorRef = adminDb.doc(orgDoc(orgId).contractor(payload.contractorId));
            const cSnap = await contractorRef.get();
            if (cSnap.exists) contractorBalance = Number(cSnap.data()?.balance || 0);
        }

        const txData = {
            ...payload,
            amount,
            orgId,
            contractorId: payload.contractorId || null,
            source: payload.source || 'manual_entry',
            status,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
            metadata: {
                ...(payload.metadata || {}),
                history: [{
                    date: new Date(), userId, userName,
                    action: 'create',
                    comment: 'Операция записана вручную'
                }]
            }
        };

        await txDoc.set(txData);
        await notifyFinanceTransaction(txDoc.id, txData, 'CREATED');

        if (status === 'completed') {
            if (accountRef) {
                const newBalance = isExpense ? accountBalance - amount : isIncome ? accountBalance + amount : accountBalance;
                await accountRef.update({ balance: newBalance });
            }
            if (contractorRef) {
                const newCBal = isExpense ? contractorBalance - amount : isIncome ? contractorBalance + amount : contractorBalance;
                await contractorRef.update({ balance: newCBal });
            }
        }

        safeRevalidatePath('/finance-hub');
        safeRevalidatePath('/finance-hub/accounts');
        return { success: true, id: txDoc.id };
    } catch (error) {
        console.error('FinanceHub: Create Failed:', error);
        return { success: false, error: String(error) };
    }
}

export async function deleteTransactionAction(orgId: string, id: string, userName: string, userId: string) {
    if (!orgId) return { success: false, error: 'orgId required' };
    try {
        const txRef = adminDb.doc(orgDoc(orgId).financeTransaction(id));
        const txSnap = await txRef.get();
        if (!txSnap.exists) return { success: false, error: 'Не найдено' };

        const txData = txSnap.data() as FinanceTransaction;
        let contractorRef: any = null, contractorBalance = 0;
        let accountRef: any = null, accountBalance = 0;

        if (txData.status === 'completed') {
            if (txData.contractorId) {
                contractorRef = adminDb.doc(orgDoc(orgId).contractor(txData.contractorId));
                const cSnap = await contractorRef.get();
                if (cSnap.exists) contractorBalance = Number(cSnap.data()?.balance || 0);
            }
            if (txData.myAccountId) {
                accountRef = adminDb.doc(orgDoc(orgId).bankAccount(txData.myAccountId));
                const accSnap = await accountRef.get();
                if (accSnap.exists) accountBalance = Number(accSnap.data()?.balance || 0);
            }
        }

        await txRef.delete();

        if (txData.status === 'completed') {
            const amount = Number(txData.amount || 0);
            const isExpense = txData.type === 'expense';
            const isIncome = txData.type === 'income';
            if (accountRef) await accountRef.update({ balance: isExpense ? accountBalance + amount : isIncome ? accountBalance - amount : accountBalance });
            if (contractorRef) await contractorRef.update({ balance: isExpense ? contractorBalance - amount : isIncome ? contractorBalance + amount : contractorBalance });
        }

        safeRevalidatePath('/finance-hub');
        safeRevalidatePath('/finance-hub/accounts');
        return { success: true };
    } catch (error) {
        console.error('FinanceHub: Delete Failed:', error);
        return { success: false, error: String(error) };
    }
}
