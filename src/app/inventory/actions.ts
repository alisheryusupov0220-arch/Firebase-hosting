'use server';

import { getFirestore, collection, addDoc, serverTimestamp, query, orderBy, getDocs, Timestamp, doc, getDoc, updateDoc, writeBatch, where } from 'firebase/firestore';
import { getFirebaseApp } from '@/firebase/server';
import { getLocalIngredients, type LocalIngredient } from '@/app/ingredients/actions';
import { revalidatePath } from 'next/cache';

// This action fetches all ingredients from our local master list.
export async function getIngredientsForInventory(): Promise<LocalIngredient[]> {
    return getLocalIngredients();
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
export async function saveInventoryCountAction(payload: SaveInventoryPayload & { taskId: string }) {
    if (!payload.items || payload.items.length === 0) {
        return { success: false, message: 'Нет данных для сохранения.' };
    }

    try {
        const db = getFirestore(getFirebaseApp());
        const batch = writeBatch(db);

        // 1. Save the new inventory count report
        const inventoryCountsCollection = collection(db, 'inventory_counts');
        const newCountRef = doc(inventoryCountsCollection);
        batch.set(newCountRef, {
            comment: payload.comment,
            items: payload.items,
            userId: payload.userId,
            userName: payload.userName,
            createdAt: serverTimestamp(),
        });

        // 2. Mark the task as completed
        const taskRef = doc(db, 'inventory_tasks', payload.taskId);
        batch.update(taskRef, { status: 'completed' });

        await batch.commit();
        
        revalidatePath('/inventory'); // Revalidate the task list page
        revalidatePath('/inventory/history');

        return { success: true, message: 'Инвентаризация успешно сохранена.' };
    } catch (error) {
        console.error('Failed to save inventory count:', error);
        const message = error instanceof Error ? error.message : 'Произошла неизвестная ошибка.';
        return { success: false, message: `Ошибка сохранения: ${message}` };
    }
}


export type InventoryCountHistoryItem = SaveInventoryPayload & {
    id: string;
    createdAt: { seconds: number, nanoseconds: number };
};

export async function getInventoryHistoryAction(): Promise<InventoryCountHistoryItem[]> {
    try {
        const db = getFirestore(getFirebaseApp());
        const countsQuery = query(collection(db, 'inventory_counts'), orderBy('createdAt', 'desc'));
        const querySnapshot = await getDocs(countsQuery);
        const history: InventoryCountHistoryItem[] = [];
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const createdAtTimestamp = data.createdAt as Timestamp;

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
        console.error('Failed to get inventory history:', error);
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

export async function saveInventoryTemplateAction(payload: InventoryTemplateData) {
    try {
        const db = getFirestore(getFirebaseApp());
        const templatesCollection = collection(db, 'inventory_templates');

        await addDoc(templatesCollection, {
            ...payload,
            createdAt: serverTimestamp(),
            ingredientIds: payload.type === 'full' ? [] : [], 
        });

        revalidatePath('/inventory/templates');
        return { success: true, message: 'Шаблон успешно сохранен.' };
    } catch (error) {
        console.error('Failed to save inventory template:', error);
        const message = error instanceof Error ? error.message : 'Произошла неизвестная ошибка.';
        return { success: false, message: `Ошибка сохранения: ${message}` };
    }
}

export type InventoryTemplate = InventoryTemplateData & {
    id: string;
    createdAt: { seconds: number, nanoseconds: number };
    ingredientIds: string[];
};

export async function getInventoryTemplatesAction(): Promise<InventoryTemplate[]> {
    try {
        const db = getFirestore(getFirebaseApp());
        const templatesQuery = query(collection(db, 'inventory_templates'), orderBy('createdAt', 'desc'));
        const querySnapshot = await getDocs(templatesQuery);
        const templates: InventoryTemplate[] = [];
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const createdAtTimestamp = data.createdAt as Timestamp;
            
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
        console.error('Failed to get inventory templates:', error);
        return [];
    }
}

// New action to update ingredients in a template
export async function updateTemplateIngredientsAction(templateId: string, ingredientIds: string[]) {
    if (!templateId) {
        return { success: false, message: 'Не указан ID шаблона.' };
    }
    try {
        const db = getFirestore(getFirebaseApp());
        const templateRef = doc(db, 'inventory_templates', templateId);
        await updateDoc(templateRef, { ingredientIds });
        
        revalidatePath(`/inventory/templates/edit/${templateId}`);
        revalidatePath('/inventory/templates');

        return { success: true, message: 'Список ингредиентов в шаблоне обновлен.' };
    } catch (error) {
        console.error('Failed to update template ingredients:', error);
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
export async function startInventoryTaskAction({ templateId, userId, userName }: { templateId: string; userId: string; userName: string; }) {
    try {
        const db = getFirestore(getFirebaseApp());
        
        const templateRef = doc(db, 'inventory_templates', templateId);
        const templateSnap = await getDoc(templateRef);

        if (!templateSnap.exists()) {
            return { success: false, message: 'Шаблон не найден.' };
        }
        const template = templateSnap.data();

        let ingredientIds: string[] = [];
        if (template.type === 'full') {
            const allIngredients = await getLocalIngredients();
            ingredientIds = allIngredients.map(ing => ing.id);
        } else {
            ingredientIds = template.ingredientIds || [];
            if (ingredientIds.length === 0) {
                 return { success: false, message: 'Для частичной инвентаризации необходимо сначала настроить список ингредиентов в шаблоне.' };
            }
        }

        const tasksCollection = collection(db, 'inventory_tasks');
        await addDoc(tasksCollection, {
            templateId: templateId,
            templateName: template.name,
            status: 'pending',
            createdAt: serverTimestamp(),
            createdBy: userId,
            createdByName: userName,
            ingredientIds: ingredientIds
        });

        revalidatePath('/inventory');

        return { success: true, message: `Задание "${template.name}" создано.` };
    } catch (error) {
        console.error('Failed to start inventory task:', error);
        const message = error instanceof Error ? error.message : 'Произошла неизвестная ошибка.';
        return { success: false, message: `Ошибка запуска: ${message}` };
    }
}

// Get all pending tasks
export async function getPendingInventoryTasksAction(): Promise<InventoryTask[]> {
    try {
        const db = getFirestore(getFirebaseApp());
        const tasksQuery = query(collection(db, 'inventory_tasks'), where('status', '==', 'pending'));
        const querySnapshot = await getDocs(tasksQuery);
        const tasks: InventoryTask[] = [];
        querySnapshot.forEach((doc) => {
             const data = doc.data();
             const createdAtTimestamp = data.createdAt as Timestamp;
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
        console.error('Failed to get pending tasks:', error);
        return [];
    }
}

// Get the specific ingredients for a single task
export async function getTaskWithIngredients(taskId: string): Promise<{ task: InventoryTask, ingredients: LocalIngredient[] } | null> {
    try {
        const db = getFirestore(getFirebaseApp());
        const taskRef = doc(db, 'inventory_tasks', taskId);
        const taskSnap = await getDoc(taskRef);

        if (!taskSnap.exists()) return null;
        
        const taskData = taskSnap.data();
        const createdAtTimestamp = taskData.createdAt as Timestamp;
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

        const allIngredients = await getLocalIngredients();
        const allIngredientsMap = new Map(allIngredients.map(ing => [ing.id, ing]));
        
        const taskIngredients = task.ingredientIds
            .map(id => allIngredientsMap.get(id))
            .filter((ing): ing is LocalIngredient => !!ing);

        return { task, ingredients: taskIngredients };

    } catch (error) {
        console.error('Failed to get task with ingredients:', error);
        return null;
    }
}
