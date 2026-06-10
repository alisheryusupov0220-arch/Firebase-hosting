'use server';

import { adminDb } from '@/firebase/server';
import { ERPItem } from '@/lib/types/erp';
import { getStorageFullBalance } from '@/lib/poster';
import { revalidatePath } from 'next/cache';

/**
 * Fetches Local ERP Items and enriches them with Live Poster Stock using ADMIN privileges.
 */
export async function getItemsWithLiveStockAction(storageId: string) {
    try {
        console.log(`[Admin Sync] Fetching ERP Items and Stock for Storage: ${storageId}`);
        
        // 1. Get Local ERP Items (Admin bypasses Rules)
        const erpItemsSnap = await adminDb.collection('erp_items').get();
        const erpItems = erpItemsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ERPItem));

        console.log(`[Admin Sync] Found ${erpItems.length} items in local database.`);

        // 2. Get Live Balance from Poster for the Storage
        const posterBalances = await getStorageFullBalance(storageId);
        
        // 3. Map Poster balances to ERP items
        const enrichedItems = erpItems.map(item => {
            const posterItem = posterBalances.find(p => String(p.ingredient_id) === item.posterId);
            return {
                ...item,
                liveStock: posterItem ? Number(posterItem.left) : 0,
                posterUnit: posterItem ? posterItem.unit : item.baseUnit
            };
        });

        return { success: true, items: enrichedItems };
    } catch (error) {
        console.error('Sprint 1 Admin Sync Failed:', error);
        return { success: false, items: [], message: error instanceof Error ? error.message : 'Unknown error' };
    }
}

/**
 * Updates a local ERP item with manual overrides (Admin).
 */
export async function updateERPItemAction(itemId: string, data: Partial<ERPItem>) {
    try {
        await adminDb.collection('erp_items').doc(itemId).set({
            ...data,
            updatedAt: new Date()
        }, { merge: true });

        revalidatePath('/ingredients');
        return { success: true };
    } catch (error) {
        console.error('Failed to update ERP Item (Admin):', error);
        return { success: false, message: error instanceof Error ? error.message : 'Unknown error' };
    }
}
