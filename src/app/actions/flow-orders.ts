'use server';

import { OrderRequest, OrderStatus, OrderItem } from '@/lib/types/erp';
import { createSupply, CreateSupplyData } from '@/lib/poster';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

/**
 * FLOW Orders Service - Bypassed Admin SDK to prevent credential errors.
 */

export async function createOrderAction(rawData: any) {
    // Logic handled by client-side direct firestore writes for now to bypass Admin SDK
    return { success: true, orderId: "manual_creation_handled_on_client" };
}

export async function pushToPosterAction(order: OrderRequest) {
    try {
        const posterData: CreateSupplyData = {
            supply: {
                date: new Date().toISOString().replace('T', ' ').slice(0, 19), 
                supplier_id: "1", // Hardcoded Master Supplier
                storage_id: String(order.locationId || "1"),
                supply_comment: `[FLOW] ${order.supplierName}: Накладная №${order.id.slice(-6).toUpperCase()}. Доставщик: ${order.driverName || '---'}`,
            },
            ingredient: order.items.map(item => {
                const actCount = item.finalWeight ?? item.invoiceWeight ?? item.count ?? 0;
                const actPricePerUnit = item.pricePerUnit || 0;
                
                return {
                    id: String(item.posterId || item.itemId),
                    type: "4", // Hardcoded to Ingredient as per Google Apps Script
                    num: String(actCount),
                    price: String(actPricePerUnit) 
                };
            })
        };

        const posterIdToken = await createSupply(posterData as any);
        if (!posterIdToken) {
            throw new Error('Poster API returned an error or empty ID.');
        }

        revalidatePath('/orders');
        return { success: true, posterSupplyId: posterIdToken };
    } catch (error) {
        console.error('Failed to push to Poster (Action):', error);
        return { success: false, message: error instanceof Error ? error.message : 'Unknown error' };
    }
}
