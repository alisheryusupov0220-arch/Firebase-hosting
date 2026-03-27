'use server';

import { getFirebaseApp } from '@/firebase/server';
import { getFirestore, doc, setDoc, collection, getDocs } from 'firebase/firestore';
import { UserRole, Location } from '@/lib/types/erp';

/**
 * Initializes the basic ERP structure in Firestore if it doesn't already exist.
 * This should be called by an admin user.
 */
export async function initializeERPStructureAction(userId: string, userEmail: string) {
    try {
        const db = getFirestore(getFirebaseApp());

        // 1. Create a default location if no locations exist
        const locationsCol = collection(db, 'locations');
        const locationsSnap = await getDocs(locationsCol);
        
        let defaultLocationId = 'main-warehouse';
        if (locationsSnap.empty) {
            const defaultLocation: Location = {
                id: defaultLocationId,
                name: 'Основной склад',
                type: 'WAREHOUSE'
            };
            await setDoc(doc(db, 'locations', defaultLocationId), defaultLocation);
        } else {
            defaultLocationId = locationsSnap.docs[0].id;
        }

        // 2. Set the current user as SUPER_ADMIN if they don't have a role
        const userRef = doc(db, 'users', userId);
        await setDoc(userRef, {
            uid: userId,
            email: userEmail,
            role: 'SUPER_ADMIN' as UserRole,
            locationIds: [defaultLocationId],
            displayName: userEmail.split('@')[0]
        }, { merge: true });

        return { success: true, message: 'ERP структура успешно инициализирована.' };
    } catch (error) {
        console.error('Failed to initialize ERP structure:', error);
        const message = error instanceof Error ? error.message : 'Неизвестная ошибка инициализации.';
        return { success: false, message: `Ошибка инициализации: ${message}` };
    }
}
