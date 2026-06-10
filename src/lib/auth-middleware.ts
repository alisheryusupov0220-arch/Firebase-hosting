import { adminAuth } from '@/firebase/server';
import { UserRole } from './types/erp';

/**
 * Checks if a user has the required roles on the server side using Admin SDK.
 * Throws an error if unauthorized.
 */
export async function verifyUserRole(userId: string, allowedRoles: UserRole[]) {
    try {
        const userRecord = await adminAuth.getUser(userId);
        const role = userRecord.customClaims?.role as UserRole;

        if (!role || !allowedRoles.includes(role)) {
            throw new Error(`Access Denied: Role ${role || 'none'} is not authorized.`);
        }

        return {
            id: userId,
            uid: userId,
            email: userRecord.email,
            role: role,
            orgId: (userRecord.customClaims?.orgId as string) || null,
            locationId: (userRecord.customClaims?.locationId as string) || null,
            locationIds: (userRecord.customClaims?.locationIds as string[]) || null,
        };
    } catch (e: any) {
        throw new Error(`Auth Verification Failed: ${e.message}`);
    }
}

/**
 * Convenience wrapper for super_admin or brand_admin only.
 */
export async function restrictToManager(userId: string) {
    return verifyUserRole(userId, ['super_admin', 'brand_admin']);
}
