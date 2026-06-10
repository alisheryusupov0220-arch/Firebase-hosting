'use server';

import { getIngredients, getProducts, getPosterSuppliers, createSupply, CreateSupplyData } from '@/lib/poster';
import { ERPItem, UnitType } from '@/lib/types/erp';
import { revalidatePath } from 'next/cache';
import { adminDb } from '@/firebase/server';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * FLOW Core Service - Bypassed Admin SDK to prevent credential errors.
 */

function normalizeUnit(posterUnit: string | null | undefined): UnitType {
    if (!posterUnit) return 'PCS';
    const unit = posterUnit.toLowerCase().trim();
    if (['kg', 'kilogram', 'кг'].includes(unit)) return 'KG';
    if (['l', 'liter', 'литр', 'л'].includes(unit)) return 'L';
    if (['g', 'gram', 'г'].includes(unit)) return 'KG';
    if (['ml', 'milliliter', 'мл'].includes(unit)) return 'L';
    return 'PCS';
}

export async function syncItemsFromPosterAction(orgId?: string) {
    try {
        const [ingredients, products] = await Promise.all([
            getIngredients(orgId),
            getProducts(undefined, orgId)
        ]);

        const items: any[] = [];

        ingredients?.forEach(ing => {
            items.push({
                id: `poster_ing_${ing.ingredient_id}`,
                posterId: String(ing.ingredient_id),
                name: ing.ingredient_name,
                type: 'RAW',
                baseUnit: normalizeUnit(ing.ingredient_unit),
                categoryId: ing.category_id || 'poster_sync',
                isActive: true,
                source: 'POSTER',
                barcode: ing.ingredient_barcode || '',
            });
        });

        products?.forEach(prod => {
            if (prod.type !== '3') return;
            items.push({
                id: `poster_prod_${prod.product_id}`,
                posterId: String(prod.product_id),
                name: prod.product_name,
                type: 'SEMI_FINISHED',
                baseUnit: normalizeUnit(prod.unit),
                categoryId: (prod as any).category_id || 'poster_sync',
                isActive: true,
                source: 'POSTER',
            });
        });

        if (orgId && items.length > 0) {
            const batchSize = 400;
            const collectionRef = adminDb.collection(`organizations/${orgId}/erp_items`);
            for (let i = 0; i < items.length; i += batchSize) {
                const batch = adminDb.batch();
                const chunk = items.slice(i, i + batchSize);
                chunk.forEach(item => {
                    const docRef = collectionRef.doc(item.id);
                    batch.set(docRef, {
                        ...item,
                        orgId,
                        updatedAt: FieldValue.serverTimestamp()
                    }, { merge: true });
                });
                await batch.commit();
            }
        }

        try {
            revalidatePath('/ingredients');
        } catch (e) {
            console.warn('[Sync] revalidatePath failed (safe to ignore in non-request contexts):', e);
        }
        return { success: true, items };
    } catch (error) {
        return { success: false, message: error instanceof Error ? error.message : 'Unknown error' };
    }
}

export async function syncSuppliersFromPosterAction(orgId?: string) {
    try {
        const suppliers = await getPosterSuppliers(orgId);
        const items = suppliers.map(s => ({
            id: `poster_${s.supplier_id}`,
            posterId: String(s.supplier_id),
            name: s.supplier_name,
            balance: 0,
            isActive: true
        }));

        if (orgId && items.length > 0) {
            const batchSize = 400;
            const collectionRef = adminDb.collection(`organizations/${orgId}/suppliers`);
            for (let i = 0; i < items.length; i += batchSize) {
                const batch = adminDb.batch();
                const chunk = items.slice(i, i + batchSize);
                chunk.forEach(item => {
                    const docRef = collectionRef.doc(item.id);
                    batch.set(docRef, {
                        ...item,
                        orgId,
                        updatedAt: FieldValue.serverTimestamp()
                    }, { merge: true });
                });
                await batch.commit();
            }
        }

        return { success: true, items };
    } catch (error) {
        return { success: false, message: error instanceof Error ? error.message : 'Unknown error' };
    }
}

export async function processSupplyAction(posterSupplyData: CreateSupplyData, userId: string, orgId?: string) {
    try {
        const posterSupplyId = await createSupply(posterSupplyData, orgId);
        if (!posterSupplyId) throw new Error('Poster API did not return a supply ID.');
        revalidatePath('/supplies');
        return { success: true, posterSupplyId };
    } catch (error) {
        return { success: false, message: error instanceof Error ? error.message : 'Unknown error' };
    }
}
