'use server';

import { getFirebaseApp } from '@/firebase/server';
import { getFirestore, collection, writeBatch, doc, serverTimestamp, setDoc, increment } from 'firebase/firestore';
import { getIngredients, getProducts, getPosterSuppliers } from '@/lib/poster';
import { ERPItem, ItemType, UnitType, StockTransaction, TransactionType, Supplier } from '@/lib/types/erp';
import { translateUnit } from '@/lib/utils';
import { revalidatePath } from 'next/cache';

/**
 * FLOW Core Service - Central logic for Product/Supply management.
 */

/**
 * Normalizes Poster unit to ERP UnitType
 */
function normalizeUnit(posterUnit: string | null | undefined): UnitType {
    if (!posterUnit) return 'PCS';
    const unit = posterUnit.toLowerCase().trim();
    if (['kg', 'kilogram', 'кг'].includes(unit)) return 'KG';
    if (['l', 'liter', 'литр', 'л'].includes(unit)) return 'L';
    if (['g', 'gram', 'г'].includes(unit)) return 'KG'; // Map grams to KG for consistency
    if (['ml', 'milliliter', 'мл'].includes(unit)) return 'L'; // Map ml to L
    return 'PCS';
}

/**
 * Syncs Items (Ingredients and Semi-finished) from Poster to Firestore
 */
export async function syncItemsFromPosterAction() {
    try {
        const db = getFirestore(getFirebaseApp());
        const batch = writeBatch(db);

        const [ingredients, products] = await Promise.all([
            getIngredients(),
            getProducts()
        ]);

        const itemsCol = collection(db, 'erp_items');
        let count = 0;

        // Process ingredients (Type: RAW)
        ingredients.forEach(ing => {
            const docId = `poster_ing_${ing.ingredient_id}`;
            const erpItem: ERPItem = {
                id: docId,
                posterId: String(ing.ingredient_id),
                name: ing.ingredient_name,
                type: 'RAW',
                baseUnit: normalizeUnit(ing.ingredient_unit),
                categoryId: 'poster_sync',
                isActive: true
            } as any; // Using any for now to handle potential extra fields

            batch.set(doc(itemsCol, docId), erpItem, { merge: true });
            count++;
        });

        // Process products of type 3 (Semi-finished)
        products.forEach(prod => {
            if (prod.type !== '3') return;
            const docId = `poster_prod_${prod.product_id}`;
            const erpItem: ERPItem = {
                id: docId,
                posterId: String(prod.product_id),
                name: prod.product_name,
                type: 'SEMI_FINISHED',
                baseUnit: normalizeUnit(prod.unit),
                categoryId: 'poster_sync',
                isActive: true
            } as any;

            batch.set(doc(itemsCol, docId), erpItem, { merge: true });
            count++;
        });

        await batch.commit();
        revalidatePath('/ingredients');
        return { success: true, count };
    } catch (error) {
        console.error('Failed to sync items from Poster:', error);
        return { success: false, message: error instanceof Error ? error.message : 'Unknown error' };
    }
}

/**
 * Syncs Suppliers from Poster to Firestore
 */
export async function syncSuppliersFromPosterAction() {
    try {
        const db = getFirestore(getFirebaseApp());
        const batch = writeBatch(db);
        const suppliers = await getPosterSuppliers();

        const suppliersCol = collection(db, 'suppliers');
        let count = 0;

        suppliers.forEach(s => {
            const docId = `poster_${s.supplier_id}`;
            const supplier: Supplier = {
                id: docId,
                posterId: String(s.supplier_id),
                name: s.supplier_name,
                balance: 0,
                isActive: true
            };
            batch.set(doc(suppliersCol, docId), supplier, { merge: true });
            count++;
        });

        await batch.commit();
        return { success: true, count };
    } catch (error) {
        console.error('Failed to sync suppliers:', error);
        return { success: false, message: error instanceof Error ? error.message : 'Unknown error' };
    }
}

/**
 * Records a Stock Transaction
 * This is the core function for any stock movement.
 */
export async function recordStockTransactionAction(data: Omit<StockTransaction, 'id' | 'timestamp'>) {
    try {
        const db = getFirestore(getFirebaseApp());
        const transactionsCol = collection(db, 'stock_transactions');
        const transactionId = doc(transactionsCol).id;

        const transaction: StockTransaction = {
            id: transactionId,
            ...data,
            timestamp: serverTimestamp()
        };

        await setDoc(doc(transactionsCol, transactionId), transaction);
        return { success: true, transactionId };
    } catch (error) {
        console.error('Failed to record stock transaction:', error);
        return { success: false, message: error instanceof Error ? error.message : 'Unknown error' };
    }
}

/**
 * Process a Supply (Incoming Goods)
 * 1. Creates a supply in Poster.
 * 2. Records local stock transactions for each item.
 * 3. Updates the last purchase price for items.
 */
import { createSupply, CreateSupplyData } from '@/lib/poster';

export async function processSupplyAction(
    posterSupplyData: CreateSupplyData,
    userId: string
) {
    try {
        // 1. Create in Poster (Critical Asset logic kept as-is)
        const posterSupplyId = await createSupply(posterSupplyData);
        if (!posterSupplyId) throw new Error('Poster API did not return a supply ID.');

        const db = getFirestore(getFirebaseApp());
        const batch = writeBatch(db);

        // 2. Record local transactions
        const transactionsCol = collection(db, 'stock_transactions');
        const itemsCol = collection(db, 'erp_items');
        const suppliersCol = collection(db, 'suppliers');
        
        let totalSumInCents = 0;

        posterSupplyData.ingredients.forEach(ing => {
            const transactionId = doc(transactionsCol).id;
            const erpItemId = ing.type === 3 ? `poster_prod_${ing.ingredient_id}` : `poster_ing_${ing.ingredient_id}`;
            
            totalSumInCents += ing.price; // the input price is sum for a line item

            // Stock Transaction
            const transaction: StockTransaction = {
                id: transactionId,
                type: 'PURCHASE',
                itemId: erpItemId,
                locationId: String(posterSupplyData.storage_id),
                quantity: ing.count,
                userId: userId,
                referenceId: String(posterSupplyId),
                timestamp: serverTimestamp(),
                comment: posterSupplyData.comment
            };
            batch.set(doc(transactionsCol, transactionId), transaction);

            // Update Item Metadata (last price)
            const pricePerUnit = ing.count > 0 ? ing.price / ing.count : 0;
            batch.update(doc(itemsCol, erpItemId), {
                lastPurchasePrice: pricePerUnit
            });
        });

        // 3. Update Supplier Balance (increase debt)
        // Note: posterSupplyData has poster supplier_id, need to find the internal ID or map it.
        // We'll use a standardized ID pattern as used in syncSuppliers: `poster_${id}`
        const supplierRef = doc(suppliersCol, `poster_${posterSupplyData.supplier_id}`);
        batch.update(supplierRef, {
            balance: increment(totalSumInCents)
        });

        await batch.commit();
        revalidatePath('/supplies');
        return { success: true, posterSupplyId };
    } catch (error) {
        console.error('Failed to process supply in FLOW Core:', error);
        return { success: false, message: error instanceof Error ? error.message : 'Unknown error' };
    }
}

/**
 * Records a payment to a supplier (decreases balance)
 */
import { PaymentTransaction } from '@/lib/types/erp';

export async function recordPaymentAction(data: Omit<PaymentTransaction, 'id' | 'timestamp'>) {
    try {
        const db = getFirestore(getFirebaseApp());
        const batch = writeBatch(db);
        
        const paymentsCol = collection(db, 'payments');
        const paymentId = doc(paymentsCol).id;
        
        const payment: PaymentTransaction = {
          id: paymentId,
          ...data,
          timestamp: serverTimestamp()
        };

        batch.set(doc(paymentsCol, paymentId), payment);
        
        // Decrease supplier debt
        const supplierRef = doc(db, 'suppliers', data.supplierId);
        batch.update(supplierRef, {
            balance: increment(-data.amount)
        });

        await batch.commit();
        return { success: true, paymentId };
    } catch (error) {
        console.error('Failed to record payment:', error);
        return { success: false, message: error instanceof Error ? error.message : 'Unknown error' };
    }
}
