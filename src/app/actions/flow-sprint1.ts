'use server';

import { getFirebaseApp } from '@/firebase/server';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { ERPItem } from '@/lib/types/erp';
import { getStorageFullBalance } from '@/lib/poster';

/**
 * Fetches Local ERP Items and enriches them with Live Poster Stock.
 */
export async function getItemsWithLiveStockAction(storageId: string) {
    try {
        const db = getFirestore(getFirebaseApp());
        
        // 1. Get Local ERP Items
        const erpItemsSnap = await getDocs(collection(db, 'erp_items'));
        const erpItems = erpItemsSnap.docs.map(doc => ({ ...doc.data() } as ERPItem));

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
        console.error('Sprint 1 Sync Failed:', error);
        return { success: false, items: [], message: error instanceof Error ? error.message : 'Unknown error' };
    }
}
