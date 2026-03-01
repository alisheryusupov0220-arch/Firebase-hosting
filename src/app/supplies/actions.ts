'use server';

import { revalidatePath } from 'next/cache';
import { createSupply, type CreateSupplyData, getStorages, getPosterSuppliers } from '@/lib/poster';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { getFirebaseApp } from '@/firebase/server';

const app = getFirebaseApp();
const db = getFirestore(app);

export async function approveSupplyOnPosterAction(pendingSupplyId: string): Promise<{ success: true, data: string } | { success: false, message: string }> {
    // This action only gets the pending supply data to send to Poster.
    const pendingSupplyRef = doc(db, 'pendingSupplies', pendingSupplyId);
    
    try {
        const pendingSupplySnap = await getDoc(pendingSupplyRef);

        if (!pendingSupplySnap.exists()) {
            throw new Error('Заявка на поставку не найдена.');
        }

        const pendingSupplyData = pendingSupplySnap.data();

        const posterData: CreateSupplyData = {
            supplier_id: pendingSupplyData.supplier_id,
            storage_id: pendingSupplyData.storage_id,
            comment: pendingSupplyData.comment,
            ingredients: pendingSupplyData.ingredients,
        };

        const newSupplyId = await createSupply(posterData);
        if (!newSupplyId) {
            throw new Error('API Poster не вернул ID поставки.');
        }
        
        // Revalidate paths that show Poster data
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
