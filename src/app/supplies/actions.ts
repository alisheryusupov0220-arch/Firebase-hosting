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
        
        const posterData: CreateSupplyData = {
            supplier_id: Number(pendingSupplyData.supplier_id),
            storage_id: Number(pendingSupplyData.storage_id),
            comment: pendingSupplyData.comment,
            ingredients: pendingSupplyData.ingredients.map((ing: any) => {
                const count = Number(ing.count);
                const totalSum = Number(ing.price);

                if (count <= 0) {
                     throw new Error(`Количество для ингредиента с ID ${ing.ingredient_id} должно быть больше нуля.`);
                }
                
                // Poster API ожидает ОБЩУЮ СУММУ за позицию в копейках/центах.
                const totalSumInCents = totalSum * 100;
                
                return {
                    ingredient_id: Number(ing.ingredient_id),
                    count: count,
                    price: totalSumInCents, // Это ОБЩАЯ СУММА в копейках
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
