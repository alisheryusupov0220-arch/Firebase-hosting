'use server';

import { revalidatePath } from 'next/cache';
import { createSupply, type CreateSupplyData } from '@/lib/poster';
import { getFirestore, doc, addDoc, updateDoc, collection, serverTimestamp, getDoc } from 'firebase/firestore';
import { getFirebaseApp } from '@/firebase/server';

// Initialize Firebase app for server-side operations
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
    try {
        const pendingSupplyRef = doc(db, 'pendingSupplies', pendingSupplyId);
        const pendingSupplySnap = await getDoc(pendingSupplyRef);

        if (!pendingSupplySnap.exists()) {
            throw new Error('Заявка на поставку не найдена.');
        }

        const pendingSupplyData = pendingSupplySnap.data();

        // Assume the user approving is an admin
        // In a real app, you'd get the admin's ID from session/auth
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
        
        await updateDoc(pendingSupplyRef, {
            status: 'approved',
            approvedBy: adminId,
            approvedAt: serverTimestamp(),
            posterSupplyId: newSupplyId,
        });

        revalidatePath('/supplies');
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
