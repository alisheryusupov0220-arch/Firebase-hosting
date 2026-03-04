'use server';

import { revalidatePath } from 'next/cache';
import { createWriteOff, type CreateWriteOffData, getStorages } from '@/lib/poster';

export async function createDirectWriteOffAction(data: CreateWriteOffData): Promise<{ success: true, data: string } | { success: false, message: string }> {
    try {
        const posterWriteOffId = await createWriteOff(data);
        if (!posterWriteOffId) {
            throw new Error('API Poster не вернул ID списания.');
        }

        revalidatePath('/write-offs');
        revalidatePath('/inventory');

        return { success: true, data: posterWriteOffId };
    } catch (error) {
        console.error('Failed to create direct write-off:', error);
        const message = error instanceof Error ? error.message : 'Произошла неизвестная ошибка.';
        return { success: false, message: `Ошибка создания списания: ${message}` };
    }
}


export async function fetchStoragesAction() {
    return getStorages();
}
