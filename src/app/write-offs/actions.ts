'use server';

import { revalidatePath } from 'next/cache';
import { createWriteOff, type CreateWriteOffData, getStorages } from '@/lib/poster';
import { getFirestore, doc, setDoc, serverTimestamp, getDocs, collection } from 'firebase/firestore';
import { getFirebaseApp } from '@/firebase/server';

export async function fetchStoragesAction() {
    return getStorages();
}

export async function createWriteOffAction(data: CreateWriteOffData) {
  try {
    const posterWriteOffId = await createWriteOff(data);

    if (!posterWriteOffId) {
        throw new Error('Poster API не вернул ID списания.');
    }

    // Save comment to firestore if it exists, to guarantee it can be displayed
    if (data.reason) {
        const db = getFirestore(getFirebaseApp());
        const commentRef = doc(db, 'writeOffComments', String(posterWriteOffId));
        await setDoc(commentRef, {
            comment: data.reason,
            createdAt: serverTimestamp(),
        });
    }

    revalidatePath('/write-offs');
    revalidatePath('/inventory');

    return { success: true, data: posterWriteOffId };
  } catch (error) {
    console.error('Failed to create write-off:', error);
    const message = error instanceof Error ? error.message : 'Произошла неизвестная ошибка.';
    return { success: false, message: `Ошибка создания списания: ${message}` };
  }
}

export async function getWriteOffCommentsAction(): Promise<Record<string, string>> {
    try {
        const db = getFirestore(getFirebaseApp());
        const commentsSnapshot = await getDocs(collection(db, 'writeOffComments'));
        const comments: Record<string, string> = {};
        commentsSnapshot.forEach(doc => {
            comments[doc.id] = doc.data().comment;
        });
        return comments;
    } catch (error) {
        console.error('Failed to get write-off comments:', error);
        return {};
    }
}
