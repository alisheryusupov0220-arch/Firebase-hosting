'use server';

import { getFirebaseApp } from '@/firebase/server';
import { getFirestore, collection, doc, setDoc, updateDoc, getDocs, query, where, serverTimestamp, increment } from 'firebase/firestore';
import { AccountsPayable, AccountingStatus, OrderRequest } from '@/lib/types/erp';
import { revalidatePath } from 'next/cache';

/**
 * Stage: Final Bridge. 
 * Creates an AccountsPayable (AP) record when a supply is confirmed.
 * Status starts as 'WAITING_INVOICE'.
 */
export async function createAccountsPayableAction(order: OrderRequest, totalAmount: number) {
    try {
        const db = getFirestore(getFirebaseApp());
        const apCol = collection(db, 'accounts_payable');
        const apId = order.id; // Linking 1:1 with OrderId for simplicity

        const apRecord: AccountsPayable = {
            id: apId,
            supplierId: order.supplierId,
            totalAmount: totalAmount,
            paidAmount: 0,
            remainingAmount: totalAmount,
            status: 'WAITING_INVOICE',
            orderId: order.id,
            createdAt: serverTimestamp(),
        };

        await setDoc(doc(apCol, apId), apRecord);
        revalidatePath('/orders');
        return { success: true };
    } catch (error) {
        return { success: false, message: error instanceof Error ? error.message : 'AP creation failed' };
    }
}

/**
 * REVERSE API: Reconcile Payment from CASH Module.
 * This is the entry point for your external CASH application.
 */
export async function reconcilePaymentFromCashAction(apId: string, paymentAmount: number, paymentRef: string) {
    try {
        const db = getFirestore(getFirebaseApp());
        const apRef = doc(db, 'accounts_payable', apId);
        
        const apSnap = await getDocs(query(collection(db, 'accounts_payable'), where('id', '==', apId)));
        if (apSnap.empty) throw new Error('AccountsPayable record not found');
        
        const apData = apSnap.docs[0].data() as AccountsPayable;
        const newPaidAmount = apData.paidAmount + paymentAmount;
        const newRemaining = apData.totalAmount - newPaidAmount;
        
        let status: AccountingStatus = 'PARTIAL_PAID';
        if (newRemaining <= 0) status = 'PAID';

        await updateDoc(apRef, {
            paidAmount: newPaidAmount,
            remainingAmount: newRemaining,
            status: status,
            comment: `Reconciled from CASH via ${paymentRef}`
        });

        // Also update the main order status if needed
        await updateDoc(doc(db, 'order_requests', apId), {
            accountingStatus: status
        });

        revalidatePath('/orders');
        return { success: true };
    } catch (error) {
        return { success: false, message: error instanceof Error ? error.message : 'Reconciliation failed' };
    }
}

/**
 * P&L Support: Get Total Costs (COGS Base)
 * Used by the CASH module to calculate net profit.
 */
export async function getCostSummaryForPnLAction(startDate: Date, endDate: Date) {
    try {
        const db = getFirestore(getFirebaseApp());
        const apQuery = query(
            collection(db, 'accounts_payable'),
            where('createdAt', '>=', startDate),
            where('createdAt', '<=', endDate)
        );

        const snap = await getDocs(apQuery);
        let totalCost = 0;
        
        snap.forEach(doc => {
            totalCost += (doc.data() as AccountsPayable).totalAmount;
        });

        return { success: true, totalCost };
    } catch (error) {
        return { success: false, totalCost: 0, message: error instanceof Error ? error.message : 'Failed to fetch costs' };
    }
}
