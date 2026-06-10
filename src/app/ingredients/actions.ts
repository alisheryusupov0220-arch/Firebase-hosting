'use server';

import { revalidatePath } from 'next/cache';
import { adminDb } from '@/firebase/server';
import { getIngredients, getProducts } from '@/lib/poster';

export async function syncIngredientsAction() {
    try {
        const batch = adminDb.batch();

        // Fetch all data from Poster
        const [ingredients, products] = await Promise.all([
            getIngredients(),
            getProducts() // Fetch without composition
        ]);
        
        const ingredientsMasterCollection = adminDb.collection('ingredients_master');
        const nameSet = new Set<string>();

        // Process ingredients from menu.getIngredients
        ingredients.forEach(ing => {
            const name = ing.ingredient_name.trim();
            if (!name || nameSet.has(name.toLowerCase())) return;

            const docId = String(ing.ingredient_id);
            if (!docId || docId === 'undefined' || docId === 'null') return;

            const docRef = ingredientsMasterCollection.doc(docId);
            batch.set(docRef, {
                id: docId,
                name: name,
                type: 'ingredient',
                unit: ing.ingredient_unit || '',
                storage_id: ing.storage_id ? String(ing.storage_id) : null,
            });
            nameSet.add(name.toLowerCase());
        });

        // Process products of type "3" (semi-finished goods) from menu.getProducts
        products.forEach(prod => {
            // In Poster, type "3" is a semi-finished good that can be treated as an ingredient
            if (prod.type !== '3') return;
            
            const name = prod.product_name.trim();
            if (!name || nameSet.has(name.toLowerCase())) return;
            
            const docId = String(prod.product_id);
            if (!docId || docId === 'undefined' || docId === 'null') return;

            // These products act like ingredients. Use their own product_id as the key.
            const docRef = ingredientsMasterCollection.doc(docId);
            batch.set(docRef, {
                id: docId,
                name: name,
                type: 'product',
                unit: prod.unit || '',
                poster_ingredient_id: prod.ingredient_id ? String(prod.ingredient_id) : null,
                storage_id: prod.storage_id ? String(prod.storage_id) : null,
            });
            nameSet.add(name.toLowerCase());
        });

        await batch.commit();

        revalidatePath('/ingredients');
        revalidatePath('/supplies');
        revalidatePath('/write-offs');

        return { success: true, count: nameSet.size };
    } catch (error) {
        console.error('Failed to sync ingredients (Admin):', error);
        const message = error instanceof Error ? error.message : 'Произошла неизвестная ошибка.';
        return { success: false, message: `Ошибка синхронизации: ${message}` };
    }
}

export type LocalIngredient = {
    id: string;
    name: string;
    unit: string;
    type: string;
    poster_ingredient_id?: string | null;
    storage_id?: string | null;
};


export async function getLocalIngredients(orgId?: string): Promise<LocalIngredient[]> {
    try {
        const targetOrgId = orgId || 'org_84a3zjo2'; // fallback default
        const querySnapshot = await adminDb.collection(`organizations/${targetOrgId}/erp_items`).orderBy('name', 'asc').get();
        const ingredients: LocalIngredient[] = [];
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            ingredients.push({
                id: doc.id,
                name: data.name || '',
                unit: data.baseUnit || '',
                type: data.type === 'SEMI_FINISHED' || data.type === 'PRODUCT' ? 'product' : 'ingredient',
                poster_ingredient_id: data.posterId || null,
                storage_id: null
            });
        });
        return ingredients;
    } catch (error) {
        console.error('Failed to get local ingredients (Admin):', error);
        return [];
    }
}
