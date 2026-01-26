'use server';

import { revalidatePath } from 'next/cache';
import { createSupply, type CreateSupplyData } from '@/lib/poster';

export async function createSupplyAction(data: CreateSupplyData) {
  try {
    const response = await createSupply(data);

    // A successful response is the new supply ID.
    // A failure can be an object with an `error` key, an empty array, or null/undefined.
    if (!response || Array.isArray(response) || (typeof response === 'object' && 'error' in response)) {
        const errorDetails = (typeof response === 'object' && 'error' in response && response.error) 
            ? JSON.stringify(response.error) 
            : 'API не вернул корректный ID поставки.';
        throw new Error(errorDetails);
    }

    revalidatePath('/supplies');
    return { success: true, data: response }; // `response` is the newSupply ID
  } catch (error) {
    console.error('Failed to create supply:', error);
    const message = error instanceof Error ? error.message : 'Произошла неизвестная ошибка.';
    return { success: false, message: `Ошибка создания поставки: ${message}` };
  }
}
