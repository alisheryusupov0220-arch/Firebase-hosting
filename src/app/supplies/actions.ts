'use server';

import { revalidatePath } from 'next/cache';
import { createSupply, type CreateSupplyData, getStorages, getPosterSuppliers } from '@/lib/poster';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { getFirebaseApp } from '@/firebase/server';
import { getLocalIngredients } from '@/app/ingredients/actions';
import { translateUnit, parseFormattedNumber } from '@/lib/utils';

const app = getFirebaseApp();
const db = getFirestore(app);

export async function approveSupplyOnPosterAction(pendingSupplyId: string): Promise<{ success: true, data: string } | { success: false, message: string }> {
    try {
        const [pendingSupplySnap, localIngredients] = await Promise.all([
            getDoc(doc(db, 'pendingSupplies', pendingSupplyId)),
            getLocalIngredients()
        ]);

        if (!pendingSupplySnap.exists()) {
            throw new Error('Заявка на поставку не найдена.');
        }

        const pendingSupplyData = pendingSupplySnap.data();
        
        const ingredientsUnitMap = new Map(localIngredients.map(ing => [ing.id, ing.unit]));

        const posterData: CreateSupplyData = {
            supplier_id: pendingSupplyData.supplier_id,
            storage_id: pendingSupplyData.storage_id,
            comment: pendingSupplyData.comment,
            ingredients: pendingSupplyData.ingredients.map((ing: any) => {
                const unit = ingredientsUnitMap.get(String(ing.ingredient_id)) || 'kg';
                const translatedUnit = translateUnit(unit);
                const isUnitBased = translatedUnit === 'штук';
                
                const count = Number(ing.count);
                const totalSum = Number(ing.price);

                if (count <= 0) {
                     throw new Error(`Количество для ингредиента с ID ${ing.ingredient_id} должно быть больше нуля.`);
                }
                const pricePerUnit = totalSum / count;
                
                const formattedCount = isUnitBased 
                    ? String(Math.round(Number(ing.count))) 
                    : Number(ing.count).toFixed(3);

                return {
                    ingredient_id: ing.ingredient_id,
                    count: formattedCount,
                    price: pricePerUnit.toFixed(2),
                    type: ing.type
                };
            }),
        };

        const newSupplyId = await createSupply(posterData);
        if (!newSupplyId) {
            throw new Error('API Poster не вернул ID поставки.');
        }
        
        revalidatePath('/supplies');
        revalidatePath('/menu-analytics');

        return { success: true, data: newSupplyId };

    } catch (error) {
        console.error('Failed to approve supply on Poster:', error);
        const message = error instanceof Error ? error.message : 'Произошла неизвестная ошибка.';
        return { success: false, message: `Ошибка одобрения поставки в Poster: ${message}` };
    }
}


export async function fetchStoragesAction() {
    return getStorages();
}

export async function fetchSuppliersAction() {
    return getPosterSuppliers();
}
