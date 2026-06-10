'use server';

import { adminDb } from '@/firebase/server';
import { FieldValue } from 'firebase-admin/firestore';
import { SystemLog, SyncQueueItem } from '@/lib/types/erp';

/**
 * Technical Logging Service
 */
export async function logSystemEventAction(data: Omit<SystemLog, 'id' | 'timestamp'>) {
    try {
        const logRef = adminDb.collection('system_logs').doc();
        const logId = logRef.id;
        
        await logRef.set({
            id: logId,
            ...data,
            timestamp: FieldValue.serverTimestamp()
        });
    } catch (e) {
        console.error('CRITICAL: Logging failed (Admin)!', e);
    }
}

/**
 * Sync Queue Engine (Enqueue)
 */
export async function enqueueSyncTaskAction(action: string, payload: any) {
    try {
        const queueRef = adminDb.collection('sync_queue').doc();
        const taskId = queueRef.id;
        
        const task: SyncQueueItem = {
            id: taskId,
            status: 'PENDING',
            action,
            payload,
            retryCount: 0,
            timestamp: FieldValue.serverTimestamp()
        };
        
        await queueRef.set(task);
        return { success: true, taskId };
    } catch (error) {
        console.error('Queue failed (Admin):', error);
        return { success: false, message: error instanceof Error ? error.message : 'Queue failed' };
    }
}

/**
 * Mark Task as Completed
 */
export async function completeSyncTaskAction(taskId: string) {
    try {
        await adminDb.collection('sync_queue').doc(taskId).update({
            status: 'COMPLETED',
            processedAt: FieldValue.serverTimestamp()
        });
    } catch (e) {
        console.error('Failed to complete sync task (Admin):', e);
    }
}

/**
 * Mark Task as Failed (with Retry logic)
 */
export async function failSyncTaskAction(taskId: string, error: string) {
    try {
        await adminDb.collection('sync_queue').doc(taskId).update({
            status: 'FAILED',
            lastError: error,
            retryCount: FieldValue.increment(1)
        });
    } catch (e) {
        console.error('Failed to fail sync task (Admin):', e);
    }
}
