'use server';

import { adminDb } from '@/firebase/server';
import { OrderRequest, OrderStatus } from '@/lib/types/erp';
import { FieldValue } from 'firebase-admin/firestore';
import { revalidatePath } from 'next/cache';
import { notifyNewOrderRequest, notifyOrderStatusChange } from '@/lib/services/telegram-procurement';
import { orgCol, orgDoc } from '@/lib/db-paths';

/**
 * Helper to get a Firestore document reference for an order.
 * If orgId is provided, accesses the path directly.
 * If orgId is not provided, falls back to a Collection Group query.
 */
async function getOrderRef(orderId: string, orgId?: string) {
  if (orgId) {
    return adminDb.collection('organizations').doc(orgId).collection('order_requests').doc(orderId);
  }
  
  // Fallback to Collection Group query (necessary for Telegram reply updates)
  const snap = await adminDb.collectionGroup('order_requests').where('id', '==', orderId).limit(1).get();
  if (snap.empty) {
    throw new Error(`Order ${orderId} not found in any organization.`);
  }
  return snap.docs[0].ref;
}

/**
 * Создание новой заявки на закуп (Staff Request)
 */
export async function createOrderAction(payload: Partial<OrderRequest>) {
    try {
        const orgId = payload.orgId;
        if (!orgId) throw new Error('Missing orgId in order payload');
        
        const orderRef = adminDb.collection('organizations').doc(orgId).collection('order_requests').doc();
        
        const newOrder = {
            ...payload,
            id: orderRef.id,
            status: 'NEED_REVIEW' as OrderStatus,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        };

        await orderRef.set(newOrder);

        // Отправляем уведомление в Telegram
        const savedDoc = await orderRef.get();
        await notifyNewOrderRequest(orderRef.id, savedDoc.data());

        revalidatePath('/orders');
        return { success: true, id: orderRef.id };
    } catch (error: any) {
        console.error('Create Order Action Error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Обновление заказа (универсальное)
 */
export async function updateOrderAction(orderId: string, updates: any, updatedBy: string, orgId?: string) {
    try {
        const orderRef = await getOrderRef(orderId, orgId);
        const oldDoc = await orderRef.get();
        const oldStatus = oldDoc.data()?.status;

        await orderRef.update({
            ...updates,
            updatedAt: FieldValue.serverTimestamp(),
        });

        const updatedDoc = await orderRef.get();
        const newStatus = updatedDoc.data()?.status;

        // Если статус изменился - отправляем уведомление
        if (newStatus !== oldStatus || (newStatus === 'FINAL_WEIGHTED')) {
            await notifyOrderStatusChange(orderId, updatedDoc.data());
        }
        
        revalidatePath('/orders');
        return { success: true };
    } catch (error: any) {
        console.error('Update Order Error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Создание заказа поставщику из общего запроса (Triage)
 */
export async function createOrderFromTriageAction(
    parentOrderId: string, 
    newOrderData: any, 
    leftoverItems: any[],
    finalStatusForParent?: OrderStatus,
    orgId?: string
) {
    try {
        const batch = adminDb.batch();
        const parentRef = await getOrderRef(parentOrderId, orgId);
        const finalOrgId = orgId || parentRef.path.split('/')[1];
        
        // 1. Создаем новый заказ
        const newOrderRef = adminDb.collection('organizations').doc(finalOrgId).collection('order_requests').doc();
        batch.set(newOrderRef, {
            ...newOrderData,
            id: newOrderRef.id,
            orgId: finalOrgId,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        });

        // 2. Обновляем родительский запрос
        if (leftoverItems.length === 0) {
            batch.update(parentRef, {
                status: finalStatusForParent || 'POSTED_TO_POSTER',
                updatedAt: FieldValue.serverTimestamp()
            });
        } else {
            batch.update(parentRef, {
                items: leftoverItems,
                updatedAt: FieldValue.serverTimestamp()
            });
        }

        await batch.commit();

        // 3. Уведомляем о новом заказе
        const savedNewOrder = await newOrderRef.get();
        if (newOrderData.status === 'APPROVED') {
            await notifyOrderStatusChange(newOrderRef.id, savedNewOrder.data());
        } else {
            await notifyNewOrderRequest(newOrderRef.id, savedNewOrder.data());
        }

        revalidatePath('/orders');
        return { success: true, id: newOrderRef.id };
    } catch (error: any) {
        console.error('Triage Action Error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Финализация заказа: отправка в Poster и создание записи в Кредиторке
 */
export async function finalizeOrderAction(
    orgId: string,
    orderId: string, 
    posterSupplyId: string, 
    totalSum: number,
    updatedBy: string
) {
    try {
        const orderRef = await getOrderRef(orderId, orgId);
        const orderSnap = await orderRef.get();
        if (!orderSnap.exists) throw new Error('Order not found');
        const order = orderSnap.data()!;

        const batch = adminDb.batch();

        // 1. Обновляем статус заказа
        batch.update(orderRef, {
            status: 'POSTED_TO_POSTER',
            totalPrice: totalSum,
            posterSupplyId: posterSupplyId,
            updatedAt: FieldValue.serverTimestamp()
        });

        // 2. Обновляем баланс поставщика
        if (order.supplierId) {
            const supplierRef = adminDb.doc(orgDoc(orgId).supplier(order.supplierId));
            batch.update(supplierRef, {
                balance: FieldValue.increment(totalSum)
            });
        }

        // 3. Создаем запись в Accounts Payable (Кредиторка)
        const apRef = adminDb.doc(orgDoc(orgId).accountPayable(orderId));
        batch.set(apRef, {
            id: orderId,
            orgId: orgId,
            supplierId: order.supplierId,
            supplierName: order.supplierName,
            totalAmount: totalSum,
            paidAmount: 0,
            remainingAmount: totalSum,
            status: 'WAITING_INVOICE',
            orderId: orderId,
            posterSupplyId: posterSupplyId,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp()
        });

        await batch.commit();

        // 4. Уведомляем Telegram
        const finalSnap = await orderRef.get();
        await notifyOrderStatusChange(orderId, finalSnap.data());

        revalidatePath('/orders');
        revalidatePath('/payable');
        
        return { success: true };
    } catch (error: any) {
        console.error('Finalize Action Error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Создание черновика поставки из OCR-распознавания
 */
export async function createDraftFromOCRAction(payload: {
    orgId: string;
    items: any[];
    supplierId?: string;
    supplierName?: string;
    locationId: string;
    locationName: string;
    imageUrl?: string;
    comment?: string;
}) {
    try {
        const orgId = payload.orgId;
        if (!orgId) throw new Error('Missing orgId');
        
        const orderRef = adminDb.collection('organizations').doc(orgId).collection('order_requests').doc();
        
        const newDraft = {
            id: orderRef.id,
            orgId,
            status: 'DRAFT' as OrderStatus,
            supplierId: payload.supplierId || '',
            supplierName: payload.supplierName || 'Неизвестный поставщик',
            locationId: payload.locationId,
            locationName: payload.locationName,
            items: payload.items,
            comment: payload.comment || 'Загружено по фото',
            imageUrl: payload.imageUrl || '',
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        };

        await orderRef.set(newDraft);

        revalidatePath('/orders');
        return { success: true, id: orderRef.id };
    } catch (error: any) {
        console.error('Create Draft OCR Action Error:', error);
        return { success: false, error: error.message };
    }
}

export async function payAccountsPayableAction(
    orgId: string,
    orderId: string,
    userId: string,
    userName: string
) {
    if (!orgId) return { success: false, error: 'Missing orgId' };
    if (!orderId) return { success: false, error: 'Missing orderId' };

    try {
        const orderRef = adminDb.collection('organizations').doc(orgId).collection('order_requests').doc(orderId);
        const orderSnap = await orderRef.get();
        if (!orderSnap.exists) throw new Error('Накладная не найдена');
        const order = orderSnap.data()!;

        const apRef = adminDb.collection('organizations').doc(orgId).collection('accounts_payable').doc(orderId);
        const apSnap = await apRef.get();
        if (!apSnap.exists) throw new Error('Счет кредиторской задолженности не найден');
        const apData = apSnap.data()!;

        const remainingAmount = Number(apData.remainingAmount ?? 0);
        if (remainingAmount <= 0) {
            return { success: true, message: 'Счет уже оплачен' };
        }

        const batch = adminDb.batch();

        // 1. Находим первый доступный расчетный счет для оплаты
        const bankAccountsSnap = await adminDb.collection(`organizations/${orgId}/bank_accounts`)
            .limit(1)
            .get();
        let accountId = '';
        let accountName = 'Касса (Default)';
        if (!bankAccountsSnap.empty) {
            const accDoc = bankAccountsSnap.docs[0];
            accountId = accDoc.id;
            accountName = accDoc.data().bankName || 'Касса';
            // Вычитаем баланс счета
            batch.update(accDoc.ref, {
                balance: FieldValue.increment(-remainingAmount)
            });
        }

        // 2. Создаем финансовую транзакцию расхода
        const txRef = adminDb.collection(`organizations/${orgId}/finance_transactions`).doc();
        const txData = {
            id: txRef.id,
            orgId,
            type: 'expense',
            amount: remainingAmount,
            contractorId: order.supplierId || null,
            counterparty: order.supplierName || 'Неизвестный поставщик',
            myAccountId: accountId || null,
            comment: `Оплата накладной №${orderId.slice(-6).toUpperCase()} (${accountName})`,
            status: 'completed',
            source: 'invoice_checkout',
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
            metadata: {
                history: [{
                    date: new Date(),
                    userId,
                    userName,
                    action: 'create',
                    comment: 'Счет оплачен через интерфейс накладной'
                }]
            }
        };
        batch.set(txRef, txData);

        // 3. Вычитаем из баланса долга контрагента в казначействе
        if (order.supplierId) {
            const contractorRef = adminDb.collection(`organizations/${orgId}/contractors`).doc(order.supplierId);
            batch.set(contractorRef, {
                balance: FieldValue.increment(-remainingAmount)
            }, { merge: true });

            // Также вычитаем из баланса поставщика в каталоге suppliers
            const supplierRef = adminDb.collection(`organizations/${orgId}/suppliers`).doc(order.supplierId);
            batch.set(supplierRef, {
                balance: FieldValue.increment(-remainingAmount)
            }, { merge: true });
        }

        // 4. Обновляем статус кредиторки (accounts_payable)
        batch.update(apRef, {
            status: 'PAID',
            paidAmount: FieldValue.increment(remainingAmount),
            remainingAmount: 0,
            updatedAt: FieldValue.serverTimestamp()
        });

        // 5. Обновляем статус накладной (order_requests)
        batch.update(orderRef, {
            status: 'ARCHIVED',
            updatedAt: FieldValue.serverTimestamp()
        });

        await batch.commit();

        // Safe revalidate paths
        function safeRevalidatePath(path: string) {
            try {
                revalidatePath(path);
            } catch (e) {
                console.warn(`[revalidatePath] failed for ${path}:`, e);
            }
        }
        safeRevalidatePath('/orders');
        safeRevalidatePath('/payable');
        safeRevalidatePath('/finance-hub/accounts');

        return { success: true };
    } catch (e: any) {
        console.error('[payAccountsPayableAction] error:', e);
        return { success: false, error: e.message || 'Ошибка проведения оплаты' };
    }
}
