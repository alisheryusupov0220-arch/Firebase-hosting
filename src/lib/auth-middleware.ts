import { getFirebaseApp } from '@/firebase/server';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { UserRole } from './types/erp';

/**
 * Checks if a user has the required roles on the server side.
 * Throws an error if unauthorized.
 */
export async function verifyUserRole(userId: string, allowedRoles: UserRole[]) {
    const db = getFirestore(getFirebaseApp());
    const userDoc = await getDoc(doc(db, 'users', userId));
    
    if (!userDoc.exists()) {
        throw new Error('User not found in ERP database.');
    }

    const userData = userDoc.data();
    const role = userData.role as UserRole;

    if (!allowedRoles.includes(role)) {
        throw new Error(`Access Denied: Role ${role} is not authorized for this action.`);
    }

    return userData;
}

/**
 * Convenience wrapper for SUPER_ADMIN or MANAGER only.
 */
export async function restrictToManager(userId: string) {
    return verifyUserRole(userId, ['SUPER_ADMIN', 'MANAGER']);
}
