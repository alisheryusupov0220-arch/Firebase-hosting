'use server';

import { getIngredients, type Ingredient } from '@/lib/poster';
import { getFirestore, query, collection, orderBy, limit, getDocs } from 'firebase/firestore';
import { getFirebaseApp } from '@/firebase/server';

// Server action to get latest prices for ingredients
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
        return { id, price: 0 };
    });

    const results = await Promise.all(pricePromises);
    results.forEach(result => {
        prices[result.id] = result.price;
    });

    return prices;
}

export async function getIngredientsAction(): Promise<Ingredient[]> {
    return getIngredients();
}
