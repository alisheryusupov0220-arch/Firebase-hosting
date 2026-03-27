'use server';

import { getFirebaseApp } from '@/firebase/server';
import { getFirestore, collection, doc, setDoc, updateDoc, serverTimestamp, increment } from 'firebase/firestore';
import { SystemLog, SyncQueueItem } from '@/lib/types/erp';

/**
 * Technical Logging Service
 */
export async function logSystemEventAction(data: Omit<SystemLog, 'id' | 'timestamp'>) {
    try {
        const db = getFirestore(getFirebaseApp());
        const logsCol = collection(db, 'system_logs');
        const logId = doc(logsCol).id;
        
        await setDoc(doc(logsCol, logId), {
            id: logId,
            ...data,
            timestamp: serverTimestamp()
        });
    } catch (e) {
        console.error('CRITICAL: Logging failed!', e);
    }
}

/**
 * Sync Queue Engine (Enqueue)
 */
export async function enqueueSyncTaskAction(action: string, payload: any) {
    try {
        const db = getFirestore(getFirebaseApp());
        const queueCol = collection(db, 'sync_queue');
        const taskId = doc(queueCol).id;
        
        const task: SyncQueueItem = {
            id: taskId,
            status: 'PENDING',
            action,
            payload,
            retryCount: 0,
            timestamp: serverTimestamp()
        };
        
        await setDoc(doc(queueCol, taskId), task);
        return { success: true, taskId };
    } catch (error) {
        return { success: false, message: error instanceof Error ? error.message : 'Queue failed' };
    }
}

/**
 * Mark Task as Completed
 */
export async function completeSyncTaskAction(taskId: string) {
    const db = getFirestore(getFirebaseApp());
    await updateDoc(doc(db, 'sync_queue', taskId), {
        status: 'COMPLETED',
        processedAt: serverTimestamp()
    });
}

/**
 * Mark Task as Failed (with Retry logic)
 */
export async function failSyncTaskAction(taskId: string, error: string) {
    const db = getFirestore(getFirebaseApp());
    await updateDoc(doc(db, 'sync_queue', taskId), {
        status: 'FAILED',
        lastError: error,
        retryCount: increment(1)
    });
}
