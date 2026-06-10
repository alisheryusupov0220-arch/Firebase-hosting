'use server';

import { adminDb } from '@/firebase/server';
import { Contractor } from '@/lib/types/erp';
import { revalidatePath } from 'next/cache';

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
        return snapshot.docs.map(doc => serializeDoc({ id: doc.id, ...doc.data() }));
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
            inn: data.inn ? String(data.inn).trim() : '',
            bankAccount: data.bankAccount ? String(data.bankAccount).replace(/\s/g, '') : '',
            bankCode: data.bankCode || '',
            bankName: data.bankName || '',
            phone: data.phone || '',
            email: data.email || '',
            address: data.address || '',
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
