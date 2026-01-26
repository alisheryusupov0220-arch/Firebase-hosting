'use server';

import { revalidatePath } from 'next/cache';
import { createSupply, type CreateSupplyData } from '@/lib/poster';

export async function createSupplyAction(data: CreateSupplyData) {
  try {
    const newSupply = await createSupply(data);
    if (!newSupply || (Array.isArray(newSupply) && newSupply.length === 0)) {
        throw new Error('API не вернул корректный ID поставки.');
    }
    revalidatePath('/supplies');
    return { success: true, data: newSupply };
  } catch (error) {
    console.error('Failed to create supply:', error);
    const message = error instanceof Error ? error.message : 'Произошла неизвестная ошибка.';
    return { success: false, message };
  }
}
