'use server';

import { adminDb } from '@/firebase/server';
import { Contractor } from '@/lib/types/erp';
import { revalidatePath } from 'next/cache';
import { getPosterSuppliers } from '@/lib/poster';

function safeRevalidatePath(path: string) {
    try {
        revalidatePath(path);
    } catch (e) {
        console.warn(`[revalidatePath] failed for ${path} (safe to ignore):`, e);
    }
}
import { orgCol, orgDoc } from '@/lib/db-paths';
import { FieldValue } from 'firebase-admin/firestore';

function serializeDoc(data: Record<string, any>): Record<string, any> {
    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
        if (value && typeof value === 'object' && '_seconds' in value) {
            result[key] = new Date(value._seconds * 1000).toISOString();
        } else if (value instanceof Date) {
            result[key] = value.toISOString();
        } else {
            result[key] = value;
        }
    }
    return result;
}

// ────────────────────────── MY COMPANIES ──────────────────────────

export async function getMyCompaniesAction(orgId: string) {
    if (!orgId) return [];
    try {
        const snapshot = await adminDb.collection(orgCol(orgId).myCompanies).orderBy('brandName', 'asc').get();
        return snapshot.docs.map(doc => serializeDoc({ id: doc.id, ...doc.data() }));
    } catch { return []; }
}

export async function createMyCompanyAction(orgId: string, data: any) {
    if (!orgId) return { success: false, error: 'orgId required' };
    try {
        const result = await adminDb.collection(orgCol(orgId).myCompanies).add({
            ...data,
            orgId,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
            isActive: true
        });
        safeRevalidatePath('/finance-hub/accounts');
        return { success: true, id: result.id };
    } catch { return { success: false, error: 'Ошибка создания компании' }; }
}

export async function updateMyCompanyAction(orgId: string, id: string, data: any) {
    if (!orgId) return { success: false, error: 'orgId required' };
    try {
        await adminDb.doc(orgDoc(orgId).myCompany(id)).update({
            ...data,
            updatedAt: FieldValue.serverTimestamp(),
        });
        safeRevalidatePath('/finance-hub/accounts');
        return { success: true };
    } catch { return { success: false, error: 'Ошибка обновления' }; }
}

export async function deleteMyCompanyAction(orgId: string, id: string) {
    if (!orgId) return { success: false, error: 'orgId required' };
    try {
        await adminDb.doc(orgDoc(orgId).myCompany(id)).delete();
        safeRevalidatePath('/finance-hub/accounts');
        return { success: true };
    } catch { return { success: false, error: 'Ошибка удаления' }; }
}

// ────────────────────────── BANK ACCOUNTS ──────────────────────────

export async function getBankAccountsAction(orgId: string) {
    if (!orgId) return [];
    try {
        const snapshot = await adminDb.collection(orgCol(orgId).bankAccounts).orderBy('balance', 'desc').get();
        return snapshot.docs.map(doc => serializeDoc({ id: doc.id, ...doc.data() }));
    } catch { return []; }
}

export async function createBankAccountAction(orgId: string, data: any) {
    if (!orgId) return { success: false, error: 'orgId required' };
    try {
        const result = await adminDb.collection(orgCol(orgId).bankAccounts).add({
            ...data,
            orgId,
            balance: Number(data.balance) || 0,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
            isActive: true
        });
        safeRevalidatePath('/finance-hub/accounts');
        return { success: true, id: result.id };
    } catch { return { success: false, error: 'Ошибка создания счета' }; }
}

export async function updateBankAccountAction(orgId: string, id: string, data: any) {
    if (!orgId) return { success: false, error: 'orgId required' };
    try {
        await adminDb.doc(orgDoc(orgId).bankAccount(id)).update({
            ...data,
            updatedAt: FieldValue.serverTimestamp(),
        });
        safeRevalidatePath('/finance-hub/accounts');
        return { success: true };
    } catch { return { success: false, error: 'Ошибка обновления' }; }
}

export async function deleteBankAccountAction(orgId: string, id: string) {
    if (!orgId) return { success: false, error: 'orgId required' };
    try {
        await adminDb.doc(orgDoc(orgId).bankAccount(id)).delete();
        safeRevalidatePath('/finance-hub/accounts');
        return { success: true };
    } catch { return { success: false, error: 'Ошибка удаления' }; }
}

// ────────────────────────── CONTRACTORS ──────────────────────────

export async function getContractorsAction(orgId: string) {
    if (!orgId) return [];
    try {
        const snapshot = await adminDb.collection(orgCol(orgId).contractors).orderBy('name', 'asc').get();
        const localContractors = snapshot.docs.map(doc => serializeDoc({ id: doc.id, ...doc.data() }));

        try {
            const posterSuppliers = await getPosterSuppliers(orgId);
            if (posterSuppliers && posterSuppliers.length > 0) {
                const existingNames = new Set(localContractors.map((c: any) => (c.name || '').trim().toLowerCase()));
                for (const ps of posterSuppliers) {
                    const name = (ps.supplier_name || ps.name || '').trim();
                    if (name && !existingNames.has(name.toLowerCase())) {
                        localContractors.push({
                            id: `poster_${ps.supplier_id || ps.id}`,
                            name: name.toUpperCase(),
                            alias: 'Poster Supplier',
                            inn: '',
                            balance: 0,
                            isPoster: true
                        });
                    }
                }
            }
        } catch (pErr) {
            console.warn('[getContractorsAction] Notice: could not load Poster suppliers:', pErr);
        }

        return localContractors;
    } catch { return []; }
}

export async function createContractorAction(orgId: string, data: Partial<Contractor>) {
    if (!orgId) return { success: false, error: 'orgId required' };
    if (!data.name) return { success: false, error: 'Имя обязательно' };
    try {
        const contractorsRef = adminDb.collection(orgCol(orgId).contractors);
        if (data.inn) {
            const cleanInn = String(data.inn).trim();
            const existing = await contractorsRef.where('inn', '==', cleanInn).get();
            if (!existing.empty) {
                const doc = existing.docs[0].data();
                return { success: false, error: `ДУБЛИКАТ: Контрагент с ИНН ${cleanInn} уже есть (${doc.name})` };
            }
        }
        const payload = {
            name: data.name.toUpperCase(),
            alias: data.alias || '',
            inn: data.inn ? String(data.inn).trim() : '',
            bankAccount: data.bankAccount ? String(data.bankAccount).replace(/\s/g, '') : '',
            bankCode: data.bankCode || '',
            bankName: data.bankName || '',
            phone: data.phone || '',
            email: data.email || '',
            address: data.address || '',
            allowCash: data.allowCash ?? true,
            isHiddenForStaff: data.isHiddenForStaff ?? false,
            balance: 0,
            orgId,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
            isActive: true
        };
        const result = await contractorsRef.add(payload);
        safeRevalidatePath('/finance-hub/accounts');
        return { success: true, id: result.id };
    } catch (error) {
        console.error('Contractor creation error:', error);
        return { success: false, error: 'Ошибка при сохранении в БД' };
    }
}

export async function updateContractorAction(orgId: string, id: string, data: Partial<Contractor>) {
    if (!orgId) return { success: false, error: 'orgId required' };
    try {
        await adminDb.doc(orgDoc(orgId).contractor(id)).update({
            ...data,
            updatedAt: FieldValue.serverTimestamp(),
        });
        safeRevalidatePath('/finance-hub/accounts');
        return { success: true };
    } catch { return { success: false, error: 'Ошибка обновления' }; }
}

export async function deleteContractorAction(orgId: string, id: string) {
    if (!orgId) return { success: false, error: 'orgId required' };
    try {
        await adminDb.doc(orgDoc(orgId).contractor(id)).delete();
        safeRevalidatePath('/finance-hub/accounts');
        return { success: true };
    } catch { return { success: false, error: 'Удаление не удалось' }; }
}

export async function updateContractorIngredientsAction(orgId: string, contractorId: string, items: any[]) {
    if (!orgId) return { success: false, error: 'orgId required' };
    try {
        await adminDb.doc(orgDoc(orgId).contractor(contractorId)).update({
            priceList: items,
            updatedAt: FieldValue.serverTimestamp(),
        });
        safeRevalidatePath('/finance-hub/accounts');
        return { success: true };
    } catch {
        return { success: false, error: 'Ошибка при обновлении списка ингредиентов' };
    }
}

export async function paySupplierAction(orgId: string, payload: {
    contractorId: string;
    amount: number;
    comment: string;
    photoUrl?: string;
    myAccountId?: string;
}) {
    if (!orgId) return { success: false, error: 'orgId required' };
    try {
        const contractorRef = adminDb.doc(orgDoc(orgId).contractor(payload.contractorId));
        const contractorSnap = await contractorRef.get();
        if (!contractorSnap.exists) return { success: false, error: 'Контрагент не найден' };
        
        const contractorData = contractorSnap.data() as Contractor;
        
        const batch = adminDb.batch();
        
        // 1. Списываем долг контрагента (уменьшаем баланс)
        batch.update(contractorRef, {
            balance: FieldValue.increment(-payload.amount),
            updatedAt: FieldValue.serverTimestamp()
        });
        
        // 2. Создаем транзакцию расхода
        const txRef = adminDb.collection(`organizations/${orgId}/finance_transactions`).doc();
        batch.set(txRef, {
            id: txRef.id,
            type: 'expense',
            status: 'completed',
            source: 'manual_entry',
            amount: payload.amount,
            currency: 'UZS',
            contractorId: payload.contractorId,
            counterparty: contractorData.name,
            counterpartyInn: contractorData.inn || null,
            counterpartyAccount: contractorData.bankAccount || null,
            myAccountId: payload.myAccountId || null,
            date: new Date().toISOString(),
            comment: payload.comment || 'Оплата поставщику',
            receiptImageUrl: payload.photoUrl || null,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp()
        });

        // 3. Если выбран внутренний счет, уменьшаем его баланс
        if (payload.myAccountId) {
            const myAccountRef = adminDb.doc(`organizations/${orgId}/bank_accounts/${payload.myAccountId}`);
            batch.update(myAccountRef, {
                balance: FieldValue.increment(-payload.amount),
                updatedAt: FieldValue.serverTimestamp()
            });
        }
        
        await batch.commit();
        safeRevalidatePath('/finance-hub/accounts');
        return { success: true };
    } catch (e) {
        console.error('paySupplierAction error:', e);
        return { success: false, error: 'Ошибка проведения платежа' };
    }
}
