'use server';

import { revalidatePath } from 'next/cache';
import { createWriteOff, type CreateWriteOffData, getStorages } from '@/lib/poster';
import { adminDb } from '@/firebase/server';
import { orgCol, orgDoc } from '@/lib/db-paths';

function safeRevalidatePath(path: string) {
    try {
        revalidatePath(path);
    } catch (e) {
        console.warn(`[revalidatePath] failed for ${path} (safe to ignore):`, e);
    }
}

export async function createDirectWriteOffAction(data: CreateWriteOffData, orgId?: string): Promise<{ success: true, data: string } | { success: false, message: string }> {
    try {
        const posterWriteOffId = await createWriteOff(data, orgId);
        if (!posterWriteOffId) {
            throw new Error('API Poster не вернул ID списания.');
        }

        safeRevalidatePath('/write-offs');
        safeRevalidatePath('/inventory');

        return { success: true, data: posterWriteOffId };
    } catch (error) {
        console.error('Failed to create direct write-off:', error);
        const message = error instanceof Error ? error.message : 'Произошла неизвестная ошибка.';
        return { success: false, message: `Ошибка создания списания: ${message}` };
    }
}

export async function fetchStoragesAction(orgId?: string) {
    try {
        return await getStorages(orgId);
    } catch (e) {
        console.warn(`[fetchStoragesAction] Poster API not configured or failed:`, e instanceof Error ? e.message : e);
        return [];
    }
}

export async function approveWriteOffOnPosterAction(orgId: string, id: string): Promise<{ success: true, data: string } | { success: false, message: string }> {
    if (!orgId) return { success: false, message: 'orgId required' };
    try {
        const docRef = adminDb.doc(orgDoc(orgId).pendingWriteOff(id));
        const docSnap = await docRef.get();
        if (!docSnap.exists) {
            throw new Error('Заявка на списание не найдена');
        }
        
        const data = docSnap.data();
        if (!data || !data.ingredients || data.ingredients.length === 0) {
            throw new Error('Пустая заявка');
        }

        // We must format the date according to Poster API expectations (Y-m-d H:i:s)
        const date = new Date();
        const pad = (n: number) => n.toString().padStart(2, '0');
        const posterDate = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;

        const writeOffData: CreateWriteOffData = {
          write_off: {
              date: posterDate,
              storage_id: "1", // we default to 1 as fallback
              reason: `[FLOW] ${data.comment || 'Списание по заявке'}`
          },
          ingredient: data.ingredients.map((ing: any) => ({
              // if we need accurate poster ID, we should really fetch it from ingredients_master
              // but pendingWriteOffs might already store the correct Poster ID in ing.ingredient_id
              id: String(ing.ingredient_id),
              type: "4", // Assuming all are ingredients. If needed, we could fetch type from ingredients_master.
              weight: String(ing.quantity)
          }))
        };

        const posterId = await createWriteOff(writeOffData, orgId);
        if (!posterId) {
             throw new Error('API Poster не вернул ID');
        }

        safeRevalidatePath('/write-offs');
        return { success: true, data: posterId };
    } catch (error) {
         console.error('approve error:', error);
         return { success: false, message: error instanceof Error ? error.message : 'Unknown error' };
    }
}
