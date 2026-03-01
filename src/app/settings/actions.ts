'use server';

import { getFirebaseApp } from '@/firebase/server';
import { getFirestore, collection, getDocs, doc, updateDoc, query, where, limit, addDoc } from 'firebase/firestore';
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
        const usersQuery = query(collection(db, 'users'));
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

export async function provisionUserAction(data: { displayName: string; telegramId: string; role: 'admin' | 'employee' }) {
    if (!data.displayName || !data.telegramId) {
        return { success: false, message: 'Имя и Telegram ID обязательны.' };
    }
    
    try {
        const db = getFirestore(getFirebaseApp());

        // Check for duplicates
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where("telegramId", "==", data.telegramId), limit(1));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            return { success: false, message: 'Сотрудник с таким Telegram ID уже существует.' };
        }

        // Dummy email for auth purposes
        const email = `telegram_${data.telegramId}@doganddog.invent`;

        await addDoc(usersRef, {
            displayName: data.displayName,
            telegramId: data.telegramId,
            role: data.role,
            email: email, // Store the dummy email for the login flow
        });

        revalidatePath('/settings');
        return { success: true, message: 'Сотрудник успешно добавлен.' };

    } catch (error) {
        console.error('Failed to provision user:', error);
        const message = error instanceof Error ? error.message : 'Произошла неизвестная ошибка.';
        return { success: false, message: `Ошибка добавления: ${message}` };
    }
}
