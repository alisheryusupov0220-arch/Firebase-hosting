'use server';

import { adminDb } from '@/firebase/server';
import { getLocalIngredients, type LocalIngredient } from '@/app/ingredients/actions';
import { revalidatePath } from 'next/cache';
import { FieldValue } from 'firebase-admin/firestore';
import { orgCol } from '@/lib/db-paths';

// This action fetches all ingredients from our local master list.
export async function getIngredientsForInventory(orgId: string): Promise<LocalIngredient[]> {
    return getLocalIngredients(orgId);
}

export type InventoryItemData = {
    ingredientId: string;
    ingredientName: string;
    unit: string;
    quantity: number;
};

export type SaveInventoryPayload = {
    comment: string;
    items: InventoryItemData[];
    userId: string;
    userName: string;
};

// This server action saves the inventory count and completes the task.
export async function saveInventoryCountAction(payload: SaveInventoryPayload & { taskId: string; orgId: string }) {
    if (!payload.items || payload.items.length === 0) {
        return { success: false, message: 'Нет данных для сохранения.' };
    }

    try {
        const batch = adminDb.batch();
        const orgId = payload.orgId || 'org_84a3zjo2';

        // 1. Save the new inventory count report
        const newCountRef = adminDb.collection(orgCol(orgId).inventoryCounts).doc();
        batch.set(newCountRef, {
            comment: payload.comment,
            items: payload.items,
            userId: payload.userId,
            userName: payload.userName,
            createdAt: FieldValue.serverTimestamp(),
            orgId
        });

        // 2. Mark the task as completed
        const taskRef = adminDb.collection(orgCol(orgId).inventoryTasks).doc(payload.taskId);
        batch.update(taskRef, { status: 'completed' });

        await batch.commit();
        
        revalidatePath('/inventory'); // Revalidate the task list page
        revalidatePath('/inventory/history');

        return { success: true, message: 'Инвентаризация успешно сохранена.' };
    } catch (error) {
        console.error('Failed to save inventory count (Admin):', error);
        const message = error instanceof Error ? error.message : 'Произошла неизвестная ошибка.';
        return { success: false, message: `Ошибка сохранения: ${message}` };
    }
}


export type InventoryCountHistoryItem = SaveInventoryPayload & {
    id: string;
    createdAt: { seconds: number, nanoseconds: number };
};

export async function getInventoryHistoryAction(orgId?: string): Promise<InventoryCountHistoryItem[]> {
    try {
        const targetOrgId = orgId || 'org_84a3zjo2';
        const querySnapshot = await adminDb.collection(orgCol(targetOrgId).inventoryCounts).orderBy('createdAt', 'desc').get();
        const history: InventoryCountHistoryItem[] = [];
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const createdAtTimestamp = data.createdAt;

            if (createdAtTimestamp) {
                const historyItem: InventoryCountHistoryItem = {
                    id: doc.id,
                    comment: data.comment,
                    items: data.items,
                    userId: data.userId,
                    userName: data.userName,
                    createdAt: {
                        seconds: createdAtTimestamp.seconds,
                        nanoseconds: createdAtTimestamp.nanoseconds,
                    },
                };
                history.push(historyItem);
            }
        });
        return history;
    } catch (error) {
        console.error('Failed to get inventory history (Admin):', error);
        return [];
    }
}


// == Templates Actions ==

export type InventoryTemplateData = {
    name: string;
    type: 'full' | 'partial';
    description: string;
    userId: string;
    userName: string;
};

export async function saveInventoryTemplateAction(payload: InventoryTemplateData, orgId?: string) {
    try {
        const targetOrgId = orgId || 'org_84a3zjo2';
        await adminDb.collection(orgCol(targetOrgId).inventoryTemplates).add({
            ...payload,
            createdAt: FieldValue.serverTimestamp(),
            ingredientIds: payload.type === 'full' ? [] : [], 
            orgId: targetOrgId
        });

        revalidatePath('/inventory/templates');
        return { success: true, message: 'Шаблон успешно сохранен.' };
    } catch (error) {
        console.error('Failed to save inventory template (Admin):', error);
        const message = error instanceof Error ? error.message : 'Произошла неизвестная ошибка.';
        return { success: false, message: `Ошибка сохранения: ${message}` };
    }
}

export type InventoryTemplate = InventoryTemplateData & {
    id: string;
    createdAt: { seconds: number, nanoseconds: number };
    ingredientIds: string[];
};

export async function getInventoryTemplatesAction(orgId?: string): Promise<InventoryTemplate[]> {
    try {
        const targetOrgId = orgId || 'org_84a3zjo2';
        const querySnapshot = await adminDb.collection(orgCol(targetOrgId).inventoryTemplates).orderBy('createdAt', 'desc').get();
        const templates: InventoryTemplate[] = [];
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const createdAtTimestamp = data.createdAt;
            
            if (createdAtTimestamp) {
                const templateItem: InventoryTemplate = {
                    id: doc.id,
                    name: data.name,
                    type: data.type,
                    description: data.description,
                    userId: data.userId,
                    userName: data.userName,
                    createdAt: {
                        seconds: createdAtTimestamp.seconds,
                        nanoseconds: createdAtTimestamp.nanoseconds,
                    },
                    ingredientIds: data.ingredientIds || [],
                };
                templates.push(templateItem);
            }
        });
        return templates;
    } catch (error) {
        console.error('Failed to get inventory templates (Admin):', error);
        return [];
    }
}

// New action to update ingredients in a template
export async function updateTemplateIngredientsAction(templateId: string, ingredientIds: string[], orgId?: string) {
    if (!templateId) {
        return { success: false, message: 'Не указан ID шаблона.' };
    }
    try {
        const targetOrgId = orgId || 'org_84a3zjo2';
        await adminDb.collection(orgCol(targetOrgId).inventoryTemplates).doc(templateId).update({ ingredientIds });
        
        revalidatePath(`/inventory/templates/edit/${templateId}`);
        revalidatePath('/inventory/templates');

        return { success: true, message: 'Список ингредиентов в шаблоне обновлен.' };
    } catch (error) {
        console.error('Failed to update template ingredients (Admin):', error);
        const message = error instanceof Error ? error.message : 'Произошла неизвестная ошибка.';
        return { success: false, message: `Ошибка обновления: ${message}` };
    }
}


// === Tasks Actions ===

export type InventoryTask = {
    id: string;
    templateId: string;
    templateName: string;
    status: 'pending' | 'completed';
    createdAt: { seconds: number, nanoseconds: number };
    createdBy: string;
    createdByName: string;
    ingredientIds: string[];
};

// New action to start an inventory task from a template
export async function startInventoryTaskAction({ templateId, userId, userName, orgId }: { templateId: string; userId: string; userName: string; orgId: string }) {
    try {
        const templateSnap = await adminDb.collection(orgCol(orgId).inventoryTemplates).doc(templateId).get();

        if (!templateSnap.exists) {
            return { success: false, message: 'Шаблон не найден.' };
        }
        const template = templateSnap.data()!;

        let ingredientIds: string[] = [];
        if (template.type === 'full') {
            const allIngredients = await getLocalIngredients(orgId);
            ingredientIds = allIngredients.map(ing => ing.id);
        } else {
            ingredientIds = template.ingredientIds || [];
            if (ingredientIds.length === 0) {
                 return { success: false, message: 'Для частичной инвентаризации необходимо сначала настроить список ингредиентов в шаблоне.' };
            }
        }

        await adminDb.collection(orgCol(orgId).inventoryTasks).add({
            templateId: templateId,
            templateName: template.name,
            status: 'pending',
            createdAt: FieldValue.serverTimestamp(),
            createdBy: userId,
            createdByName: userName,
            ingredientIds: ingredientIds,
            orgId
        });

        revalidatePath('/inventory');

        return { success: true, message: `Задание "${template.name}" создано.` };
    } catch (error) {
        console.error('Failed to start inventory task (Admin):', error);
        const message = error instanceof Error ? error.message : 'Произошла неизвестная ошибка.';
        return { success: false, message: `Ошибка запуска: ${message}` };
    }
}

// Get all pending tasks
export async function getPendingInventoryTasksAction(orgId?: string): Promise<InventoryTask[]> {
    try {
        const targetOrgId = orgId || 'org_84a3zjo2';
        const querySnapshot = await adminDb.collection(orgCol(targetOrgId).inventoryTasks).where('status', '==', 'pending').get();
        const tasks: InventoryTask[] = [];
        querySnapshot.forEach((doc) => {
             const data = doc.data();
             const createdAtTimestamp = data.createdAt;
             if (createdAtTimestamp) {
                 tasks.push({
                    id: doc.id,
                    ...data,
                    createdAt: {
                        seconds: createdAtTimestamp.seconds,
                        nanoseconds: createdAtTimestamp.nanoseconds,
                    },
                 } as InventoryTask);
             }
        });
        tasks.sort((a, b) => b.createdAt.seconds - a.createdAt.seconds);
        return tasks;
    } catch (error) {
        console.error('Failed to get pending tasks (Admin):', error);
        return [];
    }
}

// Get the specific ingredients for a single task
export async function getTaskWithIngredients(taskId: string, orgId: string): Promise<{ task: InventoryTask, ingredients: LocalIngredient[] } | null> {
    try {
        const taskSnap = await adminDb.collection(orgCol(orgId).inventoryTasks).doc(taskId).get();

        if (!taskSnap.exists) return null;
        
        const taskData = taskSnap.data()!;
        const createdAtTimestamp = taskData.createdAt;
        const task = { 
            id: taskSnap.id, 
            ...taskData,
             createdAt: createdAtTimestamp ? {
                seconds: createdAtTimestamp.seconds,
                nanoseconds: createdAtTimestamp.nanoseconds,
            } : null,
        } as InventoryTask;
        
        if (!task.ingredientIds || task.ingredientIds.length === 0) {
             return { task, ingredients: [] };
        }

        const allIngredients = await getLocalIngredients(orgId);
        const allIngredientsMap = new Map(allIngredients.map(ing => [ing.id, ing]));
        
        const taskIngredients = task.ingredientIds
            .map(id => allIngredientsMap.get(id))
            .filter((ing): ing is LocalIngredient => !!ing);

        return { task, ingredients: taskIngredients };

    } catch (error) {
        console.error('Failed to get task with ingredients (Admin):', error);
        return null;
    }
}
