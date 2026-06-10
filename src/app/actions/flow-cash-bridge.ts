'use server';

import { adminDb } from '@/firebase/server';
import { AccountsPayable, AccountingStatus, OrderRequest } from '@/lib/types/erp';
import { revalidatePath } from 'next/cache';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * Stage: Final Bridge. 
 * Creates an AccountsPayable (AP) record when a supply is confirmed.
 * Status starts as 'WAITING_INVOICE'.
 */
export async function createAccountsPayableAction(order: OrderRequest, totalAmount: number) {
    try {
        const apId = order.id; // Linking 1:1 with OrderId for simplicity

        const apRecord: AccountsPayable = {
            id: apId,
            supplierId: order.supplierId || '',
            totalAmount: totalAmount,
            paidAmount: 0,
            remainingAmount: totalAmount,
            status: 'WAITING_INVOICE',
            orderId: order.id,
            createdAt: FieldValue.serverTimestamp(),
        };

        await adminDb.collection('accounts_payable').doc(apId).set(apRecord);
        revalidatePath('/orders');
        return { success: true };
    } catch (error) {
        console.error('AP creation failed (Admin):', error);
        return { success: false, message: error instanceof Error ? error.message : 'AP creation failed' };
    }
}

/**
 * REVERSE API: Reconcile Payment from CASH Module.
 * This is the entry point for your external CASH application.
 */
export async function reconcilePaymentFromCashAction(apId: string, paymentAmount: number, paymentRef: string) {
    try {
        const apRef = adminDb.collection('accounts_payable').doc(apId);
        const apSnap = await apRef.get();
        
        if (!apSnap.exists) throw new Error('AccountsPayable record not found');
        
        const apData = apSnap.data() as AccountsPayable;
        const newPaidAmount = apData.paidAmount + paymentAmount;
        const newRemaining = apData.totalAmount - newPaidAmount;
        
        let status: AccountingStatus = 'PARTIAL_PAID';
        if (newRemaining <= 0) status = 'PAID';

        await apRef.update({
            paidAmount: newPaidAmount,
            remainingAmount: newRemaining,
            status: status,
            comment: `Reconciled from CASH via ${paymentRef}`
        });

        // Also update the main order status if needed
        await adminDb.collection('order_requests').doc(apId).update({
            accountingStatus: status
        });

        revalidatePath('/orders');
        return { success: true };
    } catch (error) {
        console.error('Reconciliation failed (Admin):', error);
        return { success: false, message: error instanceof Error ? error.message : 'Reconciliation failed' };
    }
}

/**
 * P&L Support: Get Total Costs (COGS Base)
 * Used by the CASH module to calculate net profit.
 */
export async function getCostSummaryForPnLAction(startDate: Date, endDate: Date) {
    try {
        const snap = await adminDb.collection('accounts_payable')
            .where('createdAt', '>=', startDate)
            .where('createdAt', '<=', endDate)
            .get();

        let totalCost = 0;
        
        snap.forEach(doc => {
            totalCost += (doc.data() as AccountsPayable).totalAmount;
        });

        return { success: true, totalCost };
    } catch (error) {
        console.error('Failed to fetch costs (Admin):', error);
        return { success: false, totalCost: 0, message: error instanceof Error ? error.message : 'Failed to fetch costs' };
    }
}
