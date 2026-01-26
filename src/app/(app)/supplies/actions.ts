'use server';

import { revalidatePath } from 'next/cache';
import { createSupply, type CreateSupplyData } from '@/lib/poster';

export async function createSupplyAction(data: CreateSupplyData) {
  try {
    // createSupply will now either return the ID or throw an error.
    const newSupplyId = await createSupply(data);

    if (!newSupplyId) {
        // This case should ideally not be hit if createSupply throws, but as a safeguard:
        throw new Error('API не вернул ID поставки.');
    }

    revalidatePath('/supplies');
    return { success: true, data: newSupplyId };
  } catch (error) {
    console.error('Failed to create supply via server action:', error);
    // The error message will now be whatever posterApiFetch threw.
    const message = error instanceof Error ? error.message : 'Произошла неизвестная ошибка.';
    return { success: false, message: `Ошибка создания поставки: ${message}` };
  }
}
