'use server';

import { revalidatePath } from 'next/cache';
import { createSupply, type CreateSupplyData, getStorages, getPosterSuppliers } from '@/lib/poster';
import { getFirestore, doc, addDoc, updateDoc, collection, serverTimestamp, getDoc, writeBatch } from 'firebase/firestore';
import { getFirebaseApp } from '@/firebase/server';

const app = getFirebaseApp();
const db = getFirestore(app);

export type RequestSupplyPayload = {
    supplier_id: number;
    storage_id: number;
    comment?: string;
    ingredients: {
        ingredient_id: number;
        count: number;
        price: number;
    }[];
    requesterId: string;
    requesterName: string;
};

export async function requestSupplyAction(data: RequestSupplyPayload) {
  try {
    const { requesterId, requesterName, ...supplyData } = data;
    const docRef = await addDoc(collection(db, 'pendingSupplies'), {
        ...supplyData,
        requesterId,
        requesterName,
        status: 'pending',
        createdAt: serverTimestamp(),
    });

    revalidatePath('/supplies');
    return { success: true, data: docRef.id };
  } catch (error) {
    console.error('Failed to create supply request:', error);
    const message = error instanceof Error ? error.message : 'Произошла неизвестная ошибка.';
    return { success: false, message: `Ошибка создания заявки: ${message}` };
  }
}

export async function approveSupplyAction(pendingSupplyId: string) {
    const pendingSupplyRef = doc(db, 'pendingSupplies', pendingSupplyId);
    
    try {
        const pendingSupplySnap = await getDoc(pendingSupplyRef);

        if (!pendingSupplySnap.exists()) {
            throw new Error('Заявка на поставку не найдена.');
        }

        const pendingSupplyData = pendingSupplySnap.data();

        // Assume the user approving is an admin
        const adminId = 'admin-user'; 

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
        
        // Use a batch to perform multiple writes atomically
        const batch = writeBatch(db);

        // 1. Update the original pending supply document
        batch.update(pendingSupplyRef, {
            status: 'approved',
            approvedBy: adminId,
            approvedAt: serverTimestamp(),
            posterSupplyId: newSupplyId,
        });

        // 2. Record the price history for each ingredient in the supply
        const approvalTimestamp = new Date(); // Use the same timestamp for all price records in this batch
        pendingSupplyData.ingredients.forEach((ingredient: any) => {
            const priceHistoryRef = doc(db, `ingredients/${ingredient.ingredient_id}/price_history`, String(newSupplyId));
            batch.set(priceHistoryRef, {
                price: ingredient.price,
                date: approvalTimestamp,
                supplierId: String(pendingSupplyData.supplier_id)
            });
        });

        // Commit the batch
        await batch.commit();

        revalidatePath('/supplies');
        revalidatePath('/menu-analytics');
        revalidatePath('/inventory');

        return { success: true, data: newSupplyId };

    } catch (error) {
        console.error('Failed to approve supply:', error);
        const message = error instanceof Error ? error.message : 'Произошла неизвестная ошибка.';
        return { success: false, message: `Ошибка одобрения поставки: ${message}` };
    }
}


export async function rejectSupplyAction(pendingSupplyId: string) {
    try {
        const pendingSupplyRef = doc(db, 'pendingSupplies', pendingSupplyId);
        
        // Assume the user rejecting is an admin
        const adminId = 'admin-user';

        await updateDoc(pendingSupplyRef, {
            status: 'rejected',
            rejectedBy: adminId,
            rejectedAt: serverTimestamp(),
        });
        
        revalidatePath('/supplies');
        return { success: true };
    } catch(error) {
        console.error('Failed to reject supply:', error);
        const message = error instanceof Error ? error.message : 'Произошла неизвестная ошибка.';
        return { success: false, message: `Ошибка отклонения поставки: ${message}` };
    }
}

export async function fetchStoragesAction() {
    return getStorages();
}

export async function fetchSuppliersAction() {
    return getPosterSuppliers();
}
