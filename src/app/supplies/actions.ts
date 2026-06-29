'use server';

import { revalidatePath } from 'next/cache';
import { createSupply, type CreateSupplyData, getStorages, getPosterSuppliers, getSupplies, createIngredientInPoster } from '@/lib/poster';


export async function createDirectSupplyAction(
    data: CreateSupplyData,
    orgId?: string
): Promise<{ success: true, data: string } | { success: false, message: string }> {
    try {
        // 1. Create supply in Poster
        const newSupplyId = await createSupply(data, orgId);
        if (!newSupplyId) {
            throw new Error('API Poster не вернул ID поставки.');
        }

        // Firestore write operations are now handled on the client side.

        revalidatePath('/supplies');
        revalidatePath('/menu-analytics');

        return { success: true, data: newSupplyId };

    } catch (error) {
        console.error('Failed to create direct supply:', error);
        const message = error instanceof Error ? error.message : 'Произошла неизвестная ошибка.';
        return { success: false, message: `Ошибка создания поставки: ${message}` };
    }
}


export async function fetchStoragesAction(orgId?: string) {
    try {
        return await getStorages(orgId);
    } catch (e) {
        console.warn(`[fetchStoragesAction] Poster API not configured or failed:`, e instanceof Error ? e.message : e);
        return [];
    }
}

export async function fetchSuppliersAction(orgId?: string) {
    try {
        return await getPosterSuppliers(orgId);
    } catch (e) {
        console.warn(`[fetchSuppliersAction] Poster API not configured or failed:`, e instanceof Error ? e.message : e);
        return [];
    }
}

export async function fetchSuppliesAction(orgId?: string): Promise<{ data: any[]; error: string | null }> {
    try {
        const data = await getSupplies(orgId);
        return { data, error: null };
    } catch (e) {
        const message = e instanceof Error ? e.message : 'Не удалось загрузить поставки.';
        return { data: [], error: message };
    }
}

import { notifySupplyReception } from '@/lib/services/telegram-procurement';
import { adminDb } from '@/firebase/server';
import { FieldValue } from 'firebase-admin/firestore';

export async function confirmPhotoReceptionAction(orgId: string, userId: string, payload: {
    supplierId?: string;
    supplierName?: string;
    originalSupplierName?: string;
    storageId?: string;
    comment?: string;
    photoUrl?: string;
    isPaid?: boolean;
    supplierInn?: string;
    supplierBankAccount?: string;
    supplierBankName?: string;
    supplierBankCode?: string; // MFO
    supplierPhone?: string;
    supplierAddress?: string;
    items: Array<{
        itemId?: string;
        name: string;
        originalName?: string;
        invoiceQty: number;
        factQty: number;
        price: number;
    }>;
}) {
    if (!orgId) return { success: false, message: 'Не указан orgId' };
    if (!userId) return { success: false, message: 'Не указан userId' };

    try {
        // 1. Автовыбор склада
        let finalStorageId = payload.storageId;
        if (!finalStorageId || finalStorageId === 'auto') {
            const storages = await getStorages(orgId);
            if (storages && storages.length > 0) {
                finalStorageId = String(storages[0].storage_id);
            } else {
                throw new Error('В Poster не найдено ни одного склада для автоматического выбора.');
            }
        }

        // Fetch storages to match storage name
        const storages = await getStorages(orgId);
        const storageName = storages.find(s => String(s.storage_id) === String(finalStorageId))?.storage_name || `Склад ID ${finalStorageId}`;

        // 2. Авто-сопоставление или авто-создание поставщика во FLOW (включая финансовую часть)
        let finalSupplierId = payload.supplierId;
        let supplierName = '';
        let posterSupplierId = '';

        if (finalSupplierId) {
            const supplierDoc = await adminDb.collection(`organizations/${orgId}/suppliers`).doc(finalSupplierId).get();
            if (supplierDoc.exists) {
                const sData = supplierDoc.data();
                supplierName = sData?.name || 'Неизвестен';
                posterSupplierId = sData?.posterId || '';
            }

            // Update existing contractor's legalName and aliases if originalSupplierName is present
            if (payload.originalSupplierName) {
                const originalUpper = payload.originalSupplierName.trim().toUpperCase();
                const contractorRef = adminDb.collection(`organizations/${orgId}/contractors`).doc(finalSupplierId);
                const contractorDoc = await contractorRef.get();
                if (contractorDoc.exists) {
                    const cData = contractorDoc.data();
                    const currentAliases = cData?.aliases || [];
                    const currentLegalName = cData?.legalName || '';
                    
                    const updates: Record<string, any> = {};
                    if (!currentLegalName) {
                        updates.legalName = originalUpper;
                    }
                    if (!currentAliases.includes(originalUpper) && cData?.name !== originalUpper && currentLegalName !== originalUpper) {
                        updates.aliases = FieldValue.arrayUnion(originalUpper);
                    }
                    if (Object.keys(updates).length > 0) {
                        await contractorRef.update(updates);
                        console.log(`[Update Contractor] Updated aliases/legalName for contractor ${supplierName} with OCR name: ${originalUpper}`);
                    }
                }
            }
        }

        if (!finalSupplierId && payload.supplierName) {
            const nameToSearch = payload.supplierName.trim().toUpperCase();
            const existingSuppliers = await adminDb.collection(`organizations/${orgId}/suppliers`)
                .where('name', '==', nameToSearch)
                .limit(1)
                .get();

            if (!existingSuppliers.empty) {
                const sDoc = existingSuppliers.docs[0];
                finalSupplierId = sDoc.id;
                const sData = sDoc.data();
                supplierName = sData.name;
                posterSupplierId = sData.posterId || '';

                if (payload.originalSupplierName) {
                    const originalUpper = payload.originalSupplierName.trim().toUpperCase();
                    const contractorRef = adminDb.collection(`organizations/${orgId}/contractors`).doc(finalSupplierId);
                    const contractorDoc = await contractorRef.get();
                    if (contractorDoc.exists) {
                        const cData = contractorDoc.data();
                        const currentAliases = cData?.aliases || [];
                        const currentLegalName = cData?.legalName || '';
                        
                        const updates: Record<string, any> = {};
                        if (!currentLegalName) {
                            updates.legalName = originalUpper;
                        }
                        if (!currentAliases.includes(originalUpper) && cData?.name !== originalUpper && currentLegalName !== originalUpper) {
                            updates.aliases = FieldValue.arrayUnion(originalUpper);
                        }
                        if (Object.keys(updates).length > 0) {
                            await contractorRef.update(updates);
                        }
                    }
                }
            } else {
                // Создаем нового поставщика во FLOW (чтобы долги копились синхронно и считались правильно)
                const sRef = adminDb.collection(`organizations/${orgId}/suppliers`).doc();
                finalSupplierId = sRef.id;
                supplierName = payload.supplierName.trim().toUpperCase();
                
                await sRef.set({
                    id: finalSupplierId,
                    name: supplierName,
                    phone: payload.supplierPhone || '',
                    address: payload.supplierAddress || '',
                    balance: 0,
                    isActive: true,
                    orgId,
                    createdAt: FieldValue.serverTimestamp(),
                    updatedAt: FieldValue.serverTimestamp()
                });

                // Создаем соответствующего контрагента в казначействе (для единого финансового контура)
                const cRef = adminDb.collection(`organizations/${orgId}/contractors`).doc(finalSupplierId);
                const originalUpper = payload.originalSupplierName ? payload.originalSupplierName.trim().toUpperCase() : '';
                await cRef.set({
                    id: finalSupplierId,
                    name: supplierName,
                    inn: payload.supplierInn ? String(payload.supplierInn).trim() : '',
                    bankAccount: payload.supplierBankAccount ? String(payload.supplierBankAccount).replace(/\s/g, '') : '',
                    bankCode: payload.supplierBankCode || '',
                    bankName: payload.supplierBankName || '',
                    phone: payload.supplierPhone || '',
                    email: '',
                    address: payload.supplierAddress || '',
                    balance: 0,
                    orgId,
                    createdAt: FieldValue.serverTimestamp(),
                    updatedAt: FieldValue.serverTimestamp(),
                    isActive: true,
                    legalName: originalUpper || supplierName,
                    aliases: originalUpper ? [originalUpper] : []
                });
                console.log(`[Auto-Create Supplier] Created new supplier & contractor: ${supplierName}`);
            }
        }

        if (!finalSupplierId) {
            // Если все же поставщик не определен, используем дефолтного
            const sRef = adminDb.collection(`organizations/${orgId}/suppliers`).doc();
            finalSupplierId = sRef.id;
            supplierName = 'ПРИЕМКА ПО ФОТО';
            posterSupplierId = '1';
            
            await sRef.set({
                id: finalSupplierId,
                name: supplierName,
                balance: 0,
                isActive: true,
                orgId,
                createdAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp()
            });

            const cRef = adminDb.collection(`organizations/${orgId}/contractors`).doc(finalSupplierId);
            await cRef.set({
                id: finalSupplierId,
                name: supplierName,
                balance: 0,
                orgId,
                createdAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp(),
                isActive: true
            });
        }

        // 3. Загружаем erp_items
        const erpItemsSnap = await adminDb.collection(`organizations/${orgId}/erp_items`).get();
        const erpItems = erpItemsSnap.docs.map(d => d.data());

        const resolvedItems: Array<{
            itemId: string;
            posterId: string;
            type: string;
            name: string;
            scannedName?: string;
            invoiceQty: number;
            factQty: number;
            price: number;
        }> = [];

        for (const itemPayload of payload.items) {
            let matchedItem = erpItems.find(i => i.id === itemPayload.itemId);

            // Если itemId не передан, попробуем сопоставить по имени (регистронезависимо)
            if (!matchedItem && itemPayload.name) {
                matchedItem = erpItems.find(i => i.name.trim().toLowerCase() === itemPayload.name.trim().toLowerCase());
            }

            if (matchedItem) {
                resolvedItems.push({
                    itemId: matchedItem.id,
                    posterId: matchedItem.posterId,
                    type: matchedItem.type,
                    name: matchedItem.name,
                    scannedName: itemPayload.originalName || itemPayload.name,
                    invoiceQty: itemPayload.invoiceQty,
                    factQty: itemPayload.factQty,
                    price: itemPayload.price
                });
            } else {
                console.warn(`[Reception] Skipping item ${itemPayload.name} as it could not be resolved or created.`);
            }
        }

        if (resolvedItems.length === 0) {
            throw new Error('Нет сопоставленных или созданных позиций для проведения.');
        }

        // 4. Формируем Poster приход (на основе фактического количества)
        // Находим ID поставщика в Poster по названию или по сохраненному posterId
        if (!posterSupplierId) {
            try {
                const pSuppliers = await getPosterSuppliers(orgId);
                const matchedPs = pSuppliers.find(s => 
                    s.supplier_name.trim().toLowerCase() === supplierName.trim().toLowerCase()
                );
                if (matchedPs) {
                    posterSupplierId = String(matchedPs.supplier_id);
                    console.log(`[Poster Match] Matched supplier '${supplierName}' to Poster ID: ${posterSupplierId}`);
                } else if (pSuppliers && pSuppliers.length > 0) {
                    posterSupplierId = String(pSuppliers[0].supplier_id);
                    console.log(`[Poster Match] Supplier '${supplierName}' not found in Poster. Falling back to first Poster supplier: '${pSuppliers[0].supplier_name}' (ID: ${posterSupplierId})`);
                } else {
                    posterSupplierId = "1";
                    console.log(`[Poster Match] Supplier '${supplierName}' not found in Poster and no suppliers returned. Falling back to ID '1'.`);
                }
            } catch (err) {
                console.warn(`[Poster Match] Failed to fetch suppliers from Poster:`, err);
                posterSupplierId = "1";
            }
        } else {
            console.log(`[Poster Match] Using existing Poster Supplier ID: ${posterSupplierId} for ${supplierName}`);
        }

        const dateForApi = new Date().toISOString().replace('T', ' ').slice(0, 19);
        const supplyBase = {
            date: dateForApi,
            supplier_id: posterSupplierId,
            storage_id: String(finalStorageId),
            supply_comment: `[FLOW] Приемка по фото (${supplierName}): ${payload.comment || ''}`
        };

        const payloadIngredients: any[] = [];
        const payloadProducts: any[] = [];
        const notificationItems: any[] = [];

        resolvedItems.forEach(ing => {
            notificationItems.push({
                name: ing.name,
                invoiceQty: ing.invoiceQty,
                factQty: ing.factQty,
                price: ing.price
            });

            if (ing.factQty <= 0) return;

            const pricePerUnit = (ing.price / ing.factQty).toFixed(2);

            if (ing.type === 'SEMI_FINISHED' || ing.type === 'PRODUCT') {
                payloadProducts.push({
                    product_id: String(ing.posterId),
                    num: String(ing.factQty),
                    type: "1",
                    price: pricePerUnit
                });
            } else {
                payloadIngredients.push({
                    id: String(ing.posterId),
                    num: String(ing.factQty),
                    type: "4",
                    price: pricePerUnit
                });
            }
        });

        // 5. Создаем поставку в Poster
        const posterSupplyId = await createSupply(
            {
                supply: supplyBase,
                ingredient: payloadIngredients.length > 0 ? payloadIngredients : undefined,
                products: payloadProducts.length > 0 ? payloadProducts : undefined
            } as any,
            orgId
        );

        if (!posterSupplyId) {
            throw new Error('API Poster не вернул ID созданной поставки.');
        }

        // 6. Пишем транзакции и финансовую отчетность во Firestore
        const batch = adminDb.batch();
        let totalAmount = 0;

        resolvedItems.forEach(ing => {
            if (ing.factQty > 0) {
                totalAmount += ing.price;

                const tRef = adminDb.collection(`organizations/${orgId}/stock_transactions`).doc();
                batch.set(tRef, {
                    id: tRef.id,
                    type: 'PURCHASE',
                    itemId: ing.itemId,
                    locationId: finalStorageId,
                    quantity: ing.factQty,
                    userId,
                    referenceId: posterSupplyId,
                    timestamp: FieldValue.serverTimestamp(),
                    comment: payload.comment || 'Приемка по фото'
                });

                batch.update(adminDb.collection(`organizations/${orgId}/erp_items`).doc(ing.itemId), {
                    lastPurchasePrice: ing.price / ing.factQty
                });
            }
        });

        const isPaid = payload.isPaid || false;

        if (!isPaid) {
            batch.update(adminDb.collection(`organizations/${orgId}/suppliers`).doc(finalSupplierId), {
                balance: FieldValue.increment(totalAmount)
            });

            // Также обновляем баланс контрагента в казначействе (для синхронности казначейства и долгов)
            const contractorRef = adminDb.collection(`organizations/${orgId}/contractors`).doc(finalSupplierId);
            batch.set(contractorRef, {
                id: finalSupplierId,
                name: supplierName,
                balance: FieldValue.increment(totalAmount),
                updatedAt: FieldValue.serverTimestamp(),
                isActive: true
            }, { merge: true });
        }

        // Создаем накладную-запрос (order_request) со статусом POSTED_TO_POSTER
        // Это позволит просматривать её детали, фото чека и факт приемки на странице заказов
        const orderId = `reception_${posterSupplyId}`;
        const orderRef = adminDb.collection(`organizations/${orgId}/order_requests`).doc(orderId);
        
        batch.set(orderRef, {
            id: orderId,
            orgId,
            status: 'POSTED_TO_POSTER',
            supplierId: finalSupplierId,
            supplierName: supplierName,
            locationId: finalStorageId,
            locationName: storageName,
            imageUrl: payload.photoUrl || '',
            totalPrice: totalAmount,
            comment: payload.comment || 'Приемка по фото',
            items: resolvedItems.map(it => ({
                itemId: it.itemId,
                name: it.scannedName || it.name,
                count: it.invoiceQty,
                finalWeight: it.factQty,
                pricePerUnit: it.factQty > 0 ? it.price / it.factQty : 0,
                totalPrice: it.price,
                unit: it.type === 'RAW' ? 'кг' : 'шт'
            })),
            createdBy: userId,
            posterSupplyId: posterSupplyId,
            hasCriticalDiscrepancy: resolvedItems.some(it => it.invoiceQty !== it.factQty),
            isConfirmedByAdmin: true,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp()
        });

        // Создаем запись кредиторской задолженности (accounts_payable) в финансовой части (Dedox)
        const apRef = adminDb.collection(`organizations/${orgId}/accounts_payable`).doc(orderId);
        batch.set(apRef, {
            id: orderId,
            orgId: orgId,
            supplierId: finalSupplierId,
            supplierName: supplierName,
            totalAmount: totalAmount,
            paidAmount: isPaid ? totalAmount : 0,
            remainingAmount: isPaid ? 0 : totalAmount,
            status: isPaid ? 'PAID' : 'INVOICE_RECEIVED',
            orderId: orderId,
            posterSupplyId: posterSupplyId,
            imageUrl: payload.photoUrl || '',
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp()
        });

        // Сохраняем маппинги для обучения ИИ
        for (const ing of resolvedItems) {
            if (ing.scannedName && ing.itemId) {
                try {
                    const mappingSnap = await adminDb.collection(`organizations/${orgId}/contractor_items`)
                        .where('contractorId', '==', finalSupplierId)
                        .where('supplierName', '==', ing.scannedName)
                        .limit(1)
                        .get();
                    
                    if (!mappingSnap.empty) {
                        batch.update(mappingSnap.docs[0].ref, {
                            linkedErpItemId: ing.itemId,
                            updatedAt: FieldValue.serverTimestamp()
                        });
                    } else {
                        const newMappingRef = adminDb.collection(`organizations/${orgId}/contractor_items`).doc();
                        batch.set(newMappingRef, {
                            id: newMappingRef.id,
                            contractorId: finalSupplierId,
                            linkedErpItemId: ing.itemId,
                            supplierName: ing.scannedName,
                            unit: ing.type === 'RAW' ? 'кг' : 'шт',
                            updatedAt: FieldValue.serverTimestamp(),
                            isPreferred: false,
                            isActive: true
                        });
                    }
                } catch (mapErr) {
                    console.error('[confirmPhotoReceptionAction] Failed to save mapping for item:', ing.scannedName, mapErr);
                }
            }
        }

        await batch.commit();

        // 7. Уведомление в Telegram
        await notifySupplyReception(orgId, {
            supplierName,
            storageName,
            items: notificationItems,
            comment: payload.comment,
            posterSupplyId
        });

        function safeRevalidatePath(path: string) {
            try {
                revalidatePath(path);
            } catch (e) {
                console.warn(`[revalidatePath] failed for ${path} (safe to ignore):`, e);
            }
        }

        safeRevalidatePath('/supplies');
        safeRevalidatePath('/payable');
        safeRevalidatePath('/orders');
        return { success: true, posterSupplyId };

    } catch (e: any) {
        console.error('[confirmPhotoReceptionAction] error:', e);
        return { success: false, message: e.message || 'Ошибка приемки на сервере' };
    }
}

