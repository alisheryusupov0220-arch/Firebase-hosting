'use server';

import { getFirestore, collection, addDoc, serverTimestamp, query, orderBy, getDocs, Timestamp } from 'firebase/firestore';
import { getFirebaseApp } from '@/firebase/server';
import { getLocalIngredients, type LocalIngredient } from '@/app/ingredients/actions';
import { revalidatePath } from 'next/cache';

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


export type InventoryCountHistoryItem = SaveInventoryPayload & {
    id: string;
    createdAt: { seconds: number, nanoseconds: number };
};

export async function getInventoryHistoryAction(): Promise<InventoryCountHistoryItem[]> {
    try {
        const db = getFirestore(getFirebaseApp());
        const countsQuery = query(collection(db, 'inventory_counts'), orderBy('createdAt', 'desc'));
        const querySnapshot = await getDocs(countsQuery);
        const history: InventoryCountHistoryItem[] = [];
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const createdAtTimestamp = data.createdAt as Timestamp;

            const historyItem: InventoryCountHistoryItem = {
                id: doc.id,
                comment: data.comment,
                items: data.items,
                userId: data.userId,
                userName: data.userName,
                createdAt: {
                    seconds: createdAtTimestamp.seconds,
                    nanoseconds: createdAtTimestamp.nanoseconds,
                },
            };
            history.push(historyItem);
        });
        return history;
    } catch (error) {
        console.error('Failed to get inventory history:', error);
        return [];
    }
}


// == Templates Actions ==

export type InventoryTemplateData = {
    name: string;
    type: 'full' | 'partial';
    description: string;
    userId: string;
    userName: string;
};

export async function saveInventoryTemplateAction(payload: InventoryTemplateData) {
    try {
        const db = getFirestore(getFirebaseApp());
        const templatesCollection = collection(db, 'inventory_templates');

        await addDoc(templatesCollection, {
            ...payload,
            createdAt: serverTimestamp(),
            // ingredientIds will be added later for partial templates
            ingredientIds: payload.type === 'full' ? [] : [], 
        });

        revalidatePath('/inventory/templates');
        return { success: true, message: 'Шаблон успешно сохранен.' };
    } catch (error) {
        console.error('Failed to save inventory template:', error);
        const message = error instanceof Error ? error.message : 'Произошла неизвестная ошибка.';
        return { success: false, message: `Ошибка сохранения: ${message}` };
    }
}

export type InventoryTemplate = InventoryTemplateData & {
    id: string;
    createdAt: { seconds: number, nanoseconds: number };
    ingredientIds: string[];
};

export async function getInventoryTemplatesAction(): Promise<InventoryTemplate[]> {
    try {
        const db = getFirestore(getFirebaseApp());
        const templatesQuery = query(collection(db, 'inventory_templates'), orderBy('createdAt', 'desc'));
        const querySnapshot = await getDocs(templatesQuery);
        const templates: InventoryTemplate[] = [];
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const createdAtTimestamp = data.createdAt as Timestamp;

            const templateItem: InventoryTemplate = {
                id: doc.id,
                name: data.name,
                type: data.type,
                description: data.description,
                userId: data.userId,
                userName: data.userName,
                createdAt: {
                    seconds: createdAtTimestamp.seconds,
                    nanoseconds: createdAtTimestamp.nanoseconds,
                },
                ingredientIds: data.ingredientIds || [],
            };
            templates.push(templateItem);
        });
        return templates;
    } catch (error) {
        console.error('Failed to get inventory templates:', error);
        return [];
    }
}
