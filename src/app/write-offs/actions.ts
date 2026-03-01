'use server';

import { revalidatePath } from 'next/cache';
import { createWriteOff, type CreateWriteOffData, getStorages } from '@/lib/poster';
import { getFirestore, doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { getFirebaseApp } from '@/firebase/server';

const app = getFirebaseApp();
const db = getFirestore(app);


export async function fetchStoragesAction() {
    return getStorages();
}


export async function approveWriteOffOnPosterAction(pendingWriteOffId: string): Promise<{ success: true, data: string } | { success: false, message: string }> {
    const pendingWriteOffRef = doc(db, 'pendingWriteOffs', pendingWriteOffId);

    try {
        const pendingWriteOffSnap = await getDoc(pendingWriteOffRef);

        if (!pendingWriteOffSnap.exists()) {
            throw new Error('Заявка на списание не найдена.');
        }

        const pendingData = pendingWriteOffSnap.data();
        
        const posterData: CreateWriteOffData = {
            storage_id: pendingData.storage_id,
            reason: pendingData.comment,
            ingredients: pendingData.ingredients.map((ing: any) => ({
                id: ing.ingredient_id,
                type: 4, // type 4 is ingredient from local base
                weight: ing.quantity,
            })),
        };

        const posterWriteOffId = await createWriteOff(posterData);
        if (!posterWriteOffId) {
            throw new Error('API Poster не вернул ID списания.');
        }

        revalidatePath('/write-offs');
        revalidatePath('/inventory');

        return { success: true, data: posterWriteOffId };
    } catch (error) {
        console.error('Failed to approve write-off on Poster:', error);
        const message = error instanceof Error ? error.message : 'Произошла неизвестная ошибка.';
        return { success: false, message: `Ошибка одобрения списания в Poster: ${message}` };
    }
}


export async function getWriteOffCommentsAction(): Promise<Record<string, string>> {
    try {
        const db = getFirestore(getFirebaseApp());
        // This collection may not exist with the new workflow, handle gracefully.
        const commentsSnapshot = await getDocs(collection(db, 'writeOffComments'));
        const comments: Record<string, string> = {};
        commentsSnapshot.forEach(doc => {
            comments[doc.id] = doc.data().comment;
        });
        return comments;
    } catch (error) {
        // Don't log if collection not found, it's expected
        if (error instanceof Error && !error.message.includes('firestore/permission-denied')) {
             console.error('Failed to get write-off comments:', error);
        }
        return {};
    }
}
