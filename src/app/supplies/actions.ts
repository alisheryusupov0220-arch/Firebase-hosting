'use server';

import { revalidatePath } from 'next/cache';
import { createSupply, type CreateSupplyData, getStorages, getPosterSuppliers } from '@/lib/poster';

export async function createDirectSupplyAction(
    data: CreateSupplyData,
): Promise<{ success: true, data: string } | { success: false, message: string }> {
    try {
        // 1. Create supply in Poster
        const newSupplyId = await createSupply(data);
        if (!newSupplyId) {
            throw new Error('API Poster не вернул ID поставки.');
        }

        // Firestore write operations are now handled on the client side.

        revalidatePath('/supplies');
        revalidatePath('/menu-analytics');

        return { success: true, data: newSupplyId };

    } catch (error) {
        console.error('Failed to create direct supply:', error);
        const message = error instanceof Error ? error.message : 'Произошла неизвестная ошибка.';
        return { success: false, message: `Ошибка создания поставки: ${message}` };
    }
}


export async function fetchStoragesAction() {
    return getStorages();
}

export async function fetchSuppliersAction() {
    return getPosterSuppliers();
}
