'use server';

import { revalidatePath } from 'next/cache';
import { createSupply, type CreateSupplyData, getStorages, getPosterSuppliers } from '@/lib/poster';
import { getFirestore, doc, writeBatch } from 'firebase/firestore';
import { getFirebaseApp } from '@/firebase/server';

export async function createDirectSupplyAction(
    data: CreateSupplyData,
): Promise<{ success: true, data: string } | { success: false, message: string }> {
    try {
        // 1. Create supply in Poster
        const newSupplyId = await createSupply(data);
        if (!newSupplyId) {
            throw new Error('API Poster не вернул ID поставки.');
        }

        // 2. Save price history to Firestore
        const db = getFirestore(getFirebaseApp());
        const batch = writeBatch(db);
        const approvalTimestamp = new Date();

        data.ingredients.forEach((ingredient) => {
            const priceHistoryRef = doc(db, `ingredients/${ingredient.ingredient_id}/price_history`, String(newSupplyId));
            
            // `ingredient.price` is the TOTAL sum for the line item. We need price per unit for history.
            const pricePerUnit = ingredient.count > 0 ? ingredient.price / ingredient.count : 0;
            
            batch.set(priceHistoryRef, {
                price: pricePerUnit,
                date: approvalTimestamp,
                supplierId: String(data.supplier_id)
            });
        });
        
        await batch.commit();

        revalidatePath('/supplies');
        revalidatePath('/menu-analytics');

        return { success: true, data: newSupplyId };

    } catch (error) {
        console.error('Failed to create direct supply:', error);
        const message = error instanceof Error ? error.message : 'Произошла неизвестная ошибка.';
        return { success: false, message: `Ошибка создания поставки: ${message}` };
    }
}


export async function fetchStoragesAction() {
    return getStorages();
}

export async function fetchSuppliersAction() {
    return getPosterSuppliers();
}
