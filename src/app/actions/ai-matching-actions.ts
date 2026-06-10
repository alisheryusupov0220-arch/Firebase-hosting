'use server';

import { ERPItem } from '@/lib/types/erp';
import { adminDb } from '@/firebase/server';
import { matchScannedItemsToERP, MatchResult } from '@/lib/services/ai-matching';
import { FieldValue } from 'firebase-admin/firestore';
import { orgCol } from '@/lib/db-paths';

/**
 * Основной экшен для умного сопоставления ингредиентов
 */
export async function getSmartIngredientMatchesAction(
    orgId: string,
    scannedItems: { name: string; qty?: number; price?: number }[],
    contractorId?: string
): Promise<MatchResult[]> {
    if (!orgId) return scannedItems.map(s => ({ scannedName: s.name, matchedItemId: null, confidence: 0, isNew: true }));
    try {
        // 1. Получаем все наши ингредиенты
        const erpItemsSnap = await adminDb.collection(orgCol(orgId).erpItems).where('isActive', '==', true).get();
        const internalItems = erpItemsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ERPItem));

        // 2. Ищем существующие маппинги (обучение системы)
        let existingMappings: Record<string, string> = {};
        if (contractorId) {
            const mappingsSnap = await adminDb.collection(orgCol(orgId).contractorItems)
                .where('contractorId', '==', contractorId)
                .get();
            
            mappingsSnap.docs.forEach(doc => {
                const data = doc.data();
                if (data.supplierName) {
                    existingMappings[data.supplierName.toLowerCase()] = data.linkedErpItemId;
                }
            });
        }

        // 3. Сначала проверяем точные совпадения по маппингам
        const results: MatchResult[] = [];
        const itemsToMatchWithAI: { name: string; qty?: number; price?: number }[] = [];

        scannedItems.forEach(item => {
            const lowName = item.name.toLowerCase();
            if (existingMappings[lowName]) {
                results.push({
                    scannedName: item.name,
                    matchedItemId: existingMappings[lowName],
                    confidence: 1.0,
                    isNew: false
                });
            } else {
                itemsToMatchWithAI.push(item);
            }
        });

        // 4. Остальное прогоняем через ИИ
        if (itemsToMatchWithAI.length > 0) {
            const aiResults = await matchScannedItemsToERP(itemsToMatchWithAI, internalItems);
            results.push(...aiResults.map(r => ({ ...r, isNew: true })));
        }

        return results;

    } catch (error) {
        console.error('Smart Match Action Error:', error);
        return scannedItems.map(s => ({ scannedName: s.name, matchedItemId: null, confidence: 0, isNew: true }));
    }
}

/**
 * Сохранить новую связку (обучение системы)
 */
export async function saveIngredientMappingAction(
    orgId: string,
    data: {
        contractorId: string;
        linkedErpItemId: string;
        supplierName: string;
        pricePerUnit?: number;
        unit?: string;
    }
) {
    if (!orgId) return { success: false, error: 'orgId is required' };
    try {
        // Проверяем, нет ли уже такой связки
        const existing = await adminDb.collection(orgCol(orgId).contractorItems)
            .where('contractorId', '==', data.contractorId)
            .where('supplierName', '==', data.supplierName)
            .limit(1)
            .get();

        if (!existing.empty) {
            await existing.docs[0].ref.update({
                linkedErpItemId: data.linkedErpItemId,
                updatedAt: FieldValue.serverTimestamp()
            });
        } else {
            const newDocRef = adminDb.collection(orgCol(orgId).contractorItems).doc();
            await newDocRef.set({
                ...data,
                id: newDocRef.id,
                updatedAt: FieldValue.serverTimestamp(),
                isPreferred: false,
                isActive: true
            });
        }
        return { success: true };
    } catch (error) {
        return { success: false, error: String(error) };
    }
}

/**
 * Получить историю цен по ингредиентам для конкретного поставщика
 */
export async function getSupplierPriceHistoryAction(
    orgId: string,
    supplierId: string
): Promise<Record<string, { date: string; pricePerUnit: number; qty: number }[]>> {
    if (!orgId || !supplierId) return {};
    try {
        const snap = await adminDb.collection(`organizations/${orgId}/order_requests`)
            .where('supplierId', '==', supplierId)
            .orderBy('createdAt', 'desc')
            .limit(30)
            .get();

        const historyMap: Record<string, { date: string; pricePerUnit: number; qty: number }[]> = {};

        snap.docs.forEach(doc => {
            const data = doc.data();
            const items = data.items || [];
            const dateVal = data.createdAt ? (data.createdAt.toDate ? data.createdAt.toDate() : new Date(data.createdAt)) : null;
            if (!dateVal) return;
            const dateStr = dateVal.toLocaleDateString('ru-RU');

            items.forEach((it: any) => {
                if (it.itemId) {
                    const qty = it.finalWeight || it.count || 1;
                    const pricePerUnit = it.pricePerUnit || (it.totalPrice / qty);
                    if (!historyMap[it.itemId]) {
                        historyMap[it.itemId] = [];
                    }
                    if (historyMap[it.itemId].length < 5) {
                        historyMap[it.itemId].push({
                            date: dateStr,
                            pricePerUnit,
                            qty
                        });
                    }
                }
            });
        });

        return historyMap;
    } catch (e) {
        console.error('Failed to fetch supplier price history:', e);
        return {};
    }
}

