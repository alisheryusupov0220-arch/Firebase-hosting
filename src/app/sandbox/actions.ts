'use server';

import { getIngredients, type Ingredient } from '@/lib/poster';
import { adminDb } from '@/firebase/server';

/**
 * Server action to get latest prices for ingredients from prices collection.
 */
export async function getLatestPrices(ingredientIds: string[]): Promise<Record<string, number>> {
    const prices: Record<string, number> = {};

    const pricePromises = ingredientIds.map(async (id) => {
        try {
            // Updated to admin SDK style
            const querySnapshot = await adminDb.collection(`ingredients/${id}/price_history`)
                .orderBy('date', 'desc')
                .limit(1)
                .get();

            if (!querySnapshot.empty) {
                return { id, price: querySnapshot.docs[0].data().price };
            }
        } catch (e) {
            console.error(`Failed to fetch price for ${id}:`, e);
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
