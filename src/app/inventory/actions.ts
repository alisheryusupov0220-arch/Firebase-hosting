'use server';

import { getStorageBalance, getStorages, type Storage, type StorageBalanceItem } from '@/lib/poster';
import { getFirestore, collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { getFirebaseApp } from '@/firebase/server';

// This server action fetches balance for a given storage
export async function getBalanceForStorage(storageId: string): Promise<StorageBalanceItem[]> {
    return getStorageBalance(storageId);
}

// This server action fetches latest prices for given ingredient IDs
export async function getLatestPrices(ingredientIds: string[]): Promise<Record<string, number>> {
    const db = getFirestore(getFirebaseApp());
    const prices: Record<string, number> = {};

    const pricePromises = ingredientIds.map(async (id) => {
        const pricesQuery = query(
            collection(db, `ingredients/${id}/price_history`),
            orderBy('date', 'desc'),
            limit(1)
        );
        const querySnapshot = await getDocs(pricesQuery);
        if (!querySnapshot.empty) {
            return { id, price: querySnapshot.docs[0].data().price };
        }
        return { id, price: 0 }; // Default to 0 if no price history
    });

    const results = await Promise.all(pricePromises);
    results.forEach(result => {
        prices[result.id] = result.price;
    });

    return prices;
}

// This server action fetches all storages
export async function fetchStoragesAction(): Promise<Storage[]> {
    return getStorages();
}
