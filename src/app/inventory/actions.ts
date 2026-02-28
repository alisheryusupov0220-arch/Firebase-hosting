'use server';

import { getFirestore, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { getFirebaseApp } from '@/firebase/server';
import { getLocalIngredients, type LocalIngredient } from '@/app/ingredients/actions';

// This action fetches all ingredients from our local master list.
export async function getIngredientsForInventory(): Promise<LocalIngredient[]> {
    return getLocalIngredients();
}

export type InventoryItemData = {
    ingredientId: string;
    ingredientName: string;
    unit: string;
    quantity: number;
};

export type SaveInventoryPayload = {
    comment: string;
    items: InventoryItemData[];
    userId: string;
    userName: string;
};

// This server action saves the inventory count to Firestore.
export async function saveInventoryCountAction(payload: SaveInventoryPayload) {
    if (!payload.items || payload.items.length === 0) {
        return { success: false, message: 'Нет данных для сохранения.' };
    }

    try {
        const db = getFirestore(getFirebaseApp());
        const inventoryCountsCollection = collection(db, 'inventory_counts');

        await addDoc(inventoryCountsCollection, {
            ...payload,
            createdAt: serverTimestamp(),
        });

        return { success: true, message: 'Инвентаризация успешно сохранена.' };
    } catch (error) {
        console.error('Failed to save inventory count:', error);
        const message = error instanceof Error ? error.message : 'Произошла неизвестная ошибка.';
        return { success: false, message: `Ошибка сохранения: ${message}` };
    }
}
