'use server';

import { revalidatePath } from 'next/cache';
import { createSupply, type CreateSupplyData, getStorages, getPosterSuppliers } from '@/lib/poster';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { getFirebaseApp } from '@/firebase/server';

const app = getFirebaseApp();
const db = getFirestore(app);

export async function approveSupplyOnPosterAction(pendingSupplyId: string): Promise<{ success: true, data: string } | { success: false, message: string }> {
    try {
        const pendingSupplySnap = await getDoc(doc(db, 'pendingSupplies', pendingSupplyId));

        if (!pendingSupplySnap.exists()) {
            throw new Error('Заявка на поставку не найдена.');
        }

        const pendingSupplyData = pendingSupplySnap.data();
        
        // Pass clean data to createSupply. All formatting is handled there.
        const posterData: CreateSupplyData = {
            supplier_id: Number(pendingSupplyData.supplier_id),
            storage_id: Number(pendingSupplyData.storage_id),
            comment: pendingSupplyData.comment,
            ingredients: pendingSupplyData.ingredients.map((ing: any) => {
                return {
                    ingredient_id: Number(ing.ingredient_id),
                    count: Number(ing.count),
                    price: Number(ing.price), // This is the total sum for the line item
                    type: Number(ing.type),
                    unit: ing.unit,
                };
            }),
        };

        const newSupplyId = await createSupply(posterData);
        if (!newSupplyId) {
            throw new Error('API Poster не вернул ID поставки.');
        }
        
        revalidatePath('/supplies');
        revalidatePath('/menu-analytics');

        return { success: true, data: newSupplyId };

    } catch (error) {
        console.error('Failed to approve supply on Poster:', error);
        const message = error instanceof Error ? error.message : 'Произошла неизвестная ошибка.';
        return { success: false, message: `Ошибка одобрения поставки в Poster: ${message}` };
    }
}


export async function fetchStoragesAction() {
    return getStorages();
}

export async function fetchSuppliersAction() {
    return getPosterSuppliers();
}
