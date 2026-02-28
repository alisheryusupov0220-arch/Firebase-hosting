'use server';

import { revalidatePath } from 'next/cache';
import { createWriteOff, type CreateWriteOffData } from '@/lib/poster';

export async function createWriteOffAction(data: CreateWriteOffData) {
  try {
    const result = await createWriteOff(data);

    revalidatePath('/write-offs');
    revalidatePath('/inventory');

    return { success: true, data: result };
  } catch (error) {
    console.error('Failed to create write-off:', error);
    const message = error instanceof Error ? error.message : 'Произошла неизвестная ошибка.';
    return { success: false, message: `Ошибка создания списания: ${message}` };
  }
}
