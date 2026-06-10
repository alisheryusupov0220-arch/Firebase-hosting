'use server';

import { adminDb } from '@/firebase/server';
import { FieldValue } from 'firebase-admin/firestore';
import { revalidatePath } from 'next/cache';

/**
 * Открытие кассовой смены
 */
export async function openShiftAction(payload: {
  orgId: string;
  locationId: string;
  startingBalance: number;
  cashierId: string;
  cashierName: string;
}) {
  try {
    const { orgId, locationId, startingBalance, cashierId, cashierName } = payload;
    
    // Проверить, есть ли уже открытая смена на этой точке
    const activeSnap = await adminDb.collection('organizations')
      .doc(orgId)
      .collection('locations')
      .doc(locationId)
      .collection('shifts')
      .where('status', '==', 'open')
      .limit(1)
      .get();
      
    if (!activeSnap.empty) {
      throw new Error('На этой точке уже открыта другая смена.');
    }

    const shiftRef = adminDb.collection('organizations')
      .doc(orgId)
      .collection('locations')
      .doc(locationId)
      .collection('shifts')
      .doc();

    const newShift = {
      id: shiftRef.id,
      status: 'open',
      startingBalance: Number(startingBalance),
      expectedBalance: Number(startingBalance),
      actualBalance: 0,
      discrepancy: 0,
      cashierId,
      cashierName,
      openedAt: FieldValue.serverTimestamp(),
      closedAt: null,
    };

    await shiftRef.set(newShift);
    
    revalidatePath('/orders');
    return { success: true, shiftId: shiftRef.id };
  } catch (error: any) {
    console.error('Open shift error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Закрытие кассовой смены с расчетом ожидаемого баланса и расхождения
 */
export async function closeShiftAction(payload: {
  orgId: string;
  locationId: string;
  shiftId: string;
  actualBalance: number;
}) {
  try {
    const { orgId, locationId, shiftId, actualBalance } = payload;
    
    const shiftRef = adminDb.collection('organizations')
      .doc(orgId)
      .collection('locations')
      .doc(locationId)
      .collection('shifts')
      .doc(shiftId);

    const shiftSnap = await shiftRef.get();
    if (!shiftSnap.exists) {
      throw new Error('Смена не найдена.');
    }

    const shiftData = shiftSnap.data()!;
    if (shiftData.status === 'closed') {
      throw new Error('Смена уже закрыта.');
    }

    // Считаем сумму транзакций за смену
    const txSnap = await adminDb.collection('organizations')
      .doc(orgId)
      .collection('locations')
      .doc(locationId)
      .collection('transactions')
      .where('shiftId', '==', shiftId)
      .get();

    let totalIncome = 0;
    let totalExpense = 0;

    txSnap.forEach(doc => {
      const tx = doc.data();
      const amount = Number(tx.amount || 0);
      if (tx.type === 'income') {
        totalIncome += amount;
      } else if (tx.type === 'expense') {
        totalExpense += amount;
      }
    });

    const expectedBalance = Number(shiftData.startingBalance) + totalIncome - totalExpense;
    const discrepancy = Number(actualBalance) - expectedBalance;

    await shiftRef.update({
      status: 'closed',
      actualBalance: Number(actualBalance),
      expectedBalance,
      discrepancy,
      closedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    revalidatePath('/orders');
    return { success: true, expectedBalance, discrepancy };
  } catch (error: any) {
    console.error('Close shift error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Проверка наличия активной смены
 */
export async function getActiveShiftAction(orgId: string, locationId: string) {
  try {
    const snap = await adminDb.collection('organizations')
      .doc(orgId)
      .collection('locations')
      .doc(locationId)
      .collection('shifts')
      .where('status', '==', 'open')
      .limit(1)
      .get();

    if (snap.empty) return null;
    return snap.docs[0].data();
  } catch (error) {
    console.error('Get active shift error:', error);
    return null;
  }
}

/**
 * Валидация возможности совершения транзакции кассиром
 */
export async function checkShiftActiveAction(orgId: string, locationId: string, cashierId: string) {
  try {
    const activeShift = await getActiveShiftAction(orgId, locationId);
    if (!activeShift) {
      return { active: false, message: 'Кассовая смена закрыта. Откройте смену перед проведением операций.' };
    }
    if (activeShift.cashierId !== cashierId) {
      return { active: false, message: `Кассовая смена открыта другим кассиром: ${activeShift.cashierName}.` };
    }
    return { active: true, shiftId: activeShift.id };
  } catch (error) {
    return { active: false, message: 'Ошибка проверки статуса смены.' };
  }
}
