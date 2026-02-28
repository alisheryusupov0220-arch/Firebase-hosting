'use server';

import { revalidatePath } from 'next/cache';
import { getFirebaseApp } from '@/firebase/server';
import { getFirestore, collection, writeBatch, doc, getDocs, query, orderBy } from 'firebase/firestore';
import { getIngredients, getProducts } from '@/lib/poster';

export async function syncIngredientsAction() {
    try {
        const db = getFirestore(getFirebaseApp());
        const batch = writeBatch(db);

        // Fetch all data from Poster
        const [ingredients, products] = await Promise.all([
            getIngredients(),
            getProducts() // Fetch without composition
        ]);
        
        const ingredientsMasterCollection = collection(db, 'ingredients_master');
        const nameSet = new Set<string>();

        // Process ingredients from menu.getIngredients
        ingredients.forEach(ing => {
            const name = ing.ingredient_name.trim();
            if (!name || nameSet.has(name.toLowerCase())) return;

            const docRef = doc(ingredientsMasterCollection, ing.ingredient_id);
            batch.set(docRef, {
                id: ing.ingredient_id,
                name: name,
                type: 'ingredient',
                unit: ing.ingredient_unit || '',
            });
            nameSet.add(name.toLowerCase());
        });

        // Process products of type "3" (semi-finished goods) from menu.getProducts
        products.forEach(prod => {
            // In Poster, type "3" is a semi-finished good that can be treated as an ingredient
            if (prod.type !== '3') return;
            
            const name = prod.product_name.trim();
            if (!name || nameSet.has(name.toLowerCase())) return;

            // These products act like ingredients. Use their own product_id as the key.
            const docRef = doc(ingredientsMasterCollection, prod.product_id);
            batch.set(docRef, {
                id: prod.product_id,
                name: name,
                type: 'product',
                unit: prod.unit || '',
                poster_ingredient_id: prod.ingredient_id || null, 
            });
            nameSet.add(name.toLowerCase());
        });

        await batch.commit();

        revalidatePath('/ingredients');
        revalidatePath('/supplies');
        revalidatePath('/write-offs');

        return { success: true, count: nameSet.size };
    } catch (error) {
        console.error('Failed to sync ingredients:', error);
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
};


export async function getLocalIngredients(): Promise<LocalIngredient[]> {
    try {
        const db = getFirestore(getFirebaseApp());
        const ingredientsQuery = query(collection(db, 'ingredients_master'), orderBy('name', 'asc'));
        const querySnapshot = await getDocs(ingredientsQuery);
        const ingredients: LocalIngredient[] = [];
        querySnapshot.forEach((doc) => {
            ingredients.push(doc.data() as LocalIngredient);
        });
        return ingredients;
    } catch (error) {
        console.error('Failed to get local ingredients:', error);
        return [];
    }
}
