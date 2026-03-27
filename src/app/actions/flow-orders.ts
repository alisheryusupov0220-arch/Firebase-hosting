'use server';

import { getFirebaseApp } from '@/firebase/server';
import { getFirestore, collection, doc, setDoc, updateDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { OrderRequest, OrderStatus, OrderItem } from '@/lib/types/erp';
import { createSupply, CreateSupplyData } from '@/lib/poster';
import { revalidatePath } from 'next/cache';
import { restrictToManager, verifyUserRole } from '@/lib/auth-middleware';
import { z } from 'zod';

const orderSchema = z.object({
    supplierId: z.string().min(1),
    locationId: z.string().min(1),
    limitType: z.enum(['MIN', 'OPT', 'MAX']),
    items: z.array(z.object({
        itemId: z.string().min(1),
        posterId: z.string().optional(),
        count: z.number().positive(),
        pricePerUnit: z.number().nonnegative(),
        totalPrice: z.number().nonnegative(),
    })).min(1),
    createdBy: z.string(),
    scheduleDay: z.string().optional(),
    reasonForExcess: z.string().optional(),
});

/**
 * Creates a new Order Request (Draft).
 */
export async function createOrderAction(rawData: any) {
    try {
        // 1. Validate Input (Anti-Crash)
        const data = orderSchema.parse(rawData);

        // 2. Validate Role (Security)
        await verifyUserRole(data.createdBy, ['SUPER_ADMIN', 'MANAGER', 'KITCHEN', 'STAFF_POINT']);

        const db = getFirestore(getFirebaseApp());
        const ordersCol = collection(db, 'order_requests');
        const orderId = doc(ordersCol).id;

        const order: Omit<OrderRequest, 'createdAt' | 'updatedAt'> & { createdAt: any, updatedAt: any } = {
            id: orderId,
            ...data,
            status: 'DRAFT',
            hasCriticalDiscrepancy: false,
            isConfirmedByAdmin: false,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        };

        await setDoc(doc(db, 'order_requests', orderId), order);
        revalidatePath('/orders');
        return { success: true, orderId };
    } catch (error) {
        console.error('Failed to create order:', error);
        return { success: false, message: error instanceof Error ? error.message : 'Unknown error' };
    }
}

/**
 * Stage 1: Approve Order (Manager)
 */
export async function approveOrderAction(orderId: string, managerUid: string) {
    // Security: Only manager
    await restrictToManager(managerUid);

    const db = getFirestore(getFirebaseApp());
    await updateDoc(doc(db, 'order_requests', orderId), {
        status: 'APPROVED',
        approvedBy: managerUid,
        updatedAt: serverTimestamp()
    });
    revalidatePath('/orders');
}

/**
 * Stage 2: Verify on Gate (Unloading)
 */
export async function verifyOnGateAction(orderId: string, staffUid: string, invoiceRef?: string) {
    const db = getFirestore(getFirebaseApp());
    await updateDoc(doc(db, 'order_requests', orderId), {
        status: 'VERIFIED_ON_GATE',
        verifiedBy: staffUid,
        supplierInvoiceRef: invoiceRef,
        updatedAt: serverTimestamp()
    });
    revalidatePath('/orders');
}

/**
 * Stage 3: Finalize Weight & Discrepancy Check
 */
export async function finalizeWeightAction(orderId: string, staffUid: string, items: OrderItem[]) {
    try {
        const db = getFirestore(getFirebaseApp());
        const orderRef = doc(db, 'order_requests', orderId);

        let hasCriticalDiscrepancy = false;
        
        const validatedItems = items.map(item => {
            if (item.invoiceWeight && item.finalWeight) {
                const diffPercent = (Math.abs(item.finalWeight - item.invoiceWeight) / item.invoiceWeight) * 100;
                if (diffPercent > 3) hasCriticalDiscrepancy = true;
                return { ...item, deviation: diffPercent };
            }
            return item;
        });

        await updateDoc(orderRef, {
            status: 'FINAL_WEIGHTED',
            finalizedBy: staffUid,
            items: validatedItems,
            hasCriticalDiscrepancy,
            updatedAt: serverTimestamp()
        });

        revalidatePath('/orders');
        return { success: true, hasCriticalDiscrepancy };
    } catch (error) {
        return { success: false, message: error instanceof Error ? error.message : 'Unknown error' };
    }
}

/**
 * Final: Push to Poster
 */
export async function pushToPosterAction(orderId: string, userId: string) {
    try {
        // 1. Security check: Only Manager or SuperAdmin
        const userData = await restrictToManager(userId);

        const db = getFirestore(getFirebaseApp());
        const orderSnap = await getDoc(doc(db, 'order_requests', orderId));
        
        if (!orderSnap.exists()) throw new Error('Order not found');
        const order = orderSnap.data() as OrderRequest;

        // 2. Discrepancy Check
        if (order.hasCriticalDiscrepancy && !order.isConfirmedByAdmin && userData.role !== 'SUPER_ADMIN') {
            throw new Error('Критическое расхождение! Требуется подтверждение Супер-Админа.');
        }

        // Map to Poster
        const posterData: CreateSupplyData = {
            supplier_id: Number(order.supplierId),
            storage_id: Number(order.locationId),
            comment: `FLOW Order ID: ${order.id}. ${order.reasonForExcess || ''}`,
            ingredients: order.items.map(item => ({
                ingredient_id: Number(item.posterId),
                count: item.finalWeight || item.count,
                price: item.totalPrice,
                type: 1, 
                unit: 'KG'
            }))
        };

        const posterIdToken = await createSupply(posterData);
        if (posterIdToken) {
            await updateDoc(doc(db, 'order_requests', orderId), {
                status: 'POSTED_TO_POSTER',
                updatedAt: serverTimestamp()
            });
        }

        revalidatePath('/orders');
        return { success: true };
    } catch (error) {
        return { success: false, message: error instanceof Error ? error.message : 'Unknown error' };
    }
}

/**
 * External Status Update (for Telegram Bot)
 */
export async function updateOrderStatusFromExternalAction(orderId: string, newStatus: OrderStatus, botId: string) {
    try {
        const db = getFirestore(getFirebaseApp());
        const orderRef = doc(db, 'order_requests', orderId);
        
        await updateDoc(orderRef, {
            status: newStatus,
            updatedAt: serverTimestamp(),
            comment: `Автоматическое обновление через бота: ${botId}`
        });

        revalidatePath('/orders');
        return { success: true };
    } catch (error) {
        return { success: false, message: error instanceof Error ? error.message : 'Unknown error' };
    }
}
