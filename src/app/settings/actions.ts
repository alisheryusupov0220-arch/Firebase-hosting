'use server';

import { getFirebaseApp } from '@/firebase/server';
import { getFirestore, collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { revalidatePath } from 'next/cache';

// Define the UserProfile type for server-side usage
export type UserProfileServer = {
    id: string;
    displayName?: string;
    email?: string;
    role?: 'admin' | 'employee';
    telegramId?: string;
};

export async function getUsersAction(): Promise<UserProfileServer[]> {
    try {
        const db = getFirestore(getFirebaseApp());
        const usersQuery = collection(db, 'users');
        const querySnapshot = await getDocs(usersQuery);
        const users: UserProfileServer[] = [];
        querySnapshot.forEach((doc) => {
            users.push({ id: doc.id, ...doc.data() } as UserProfileServer);
        });
        return users;
    } catch (error) {
        console.error('Failed to get users:', error);
        return [];
    }
}

export async function updateUserAction(uid: string, data: Partial<UserProfileServer>) {
    if (!uid) {
        return { success: false, message: 'Не указан ID пользователя.' };
    }
    try {
        const db = getFirestore(getFirebaseApp());
        const userRef = doc(db, 'users', uid);
        await updateDoc(userRef, data);
        
        revalidatePath(`/settings`);

        return { success: true, message: 'Профиль пользователя обновлен.' };
    } catch (error) {
        console.error('Failed to update user:', error);
        const message = error instanceof Error ? error.message : 'Произошла неизвестная ошибка.';
        return { success: false, message: `Ошибка обновления: ${message}` };
    }
}
