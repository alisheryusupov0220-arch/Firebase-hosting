'use server';

import { adminDb, adminAuth } from '@/firebase/server';
import { revalidatePath } from 'next/cache';

export type UserProfileServer = {
    id: string;
    displayName?: string;
    email?: string;
    role?: 'brand_admin' | 'employee' | 'super_admin' | 'outlet_admin' | 'cashier';
    telegramId?: string;
    locationId?: string | null;
    locationIds?: string[] | null;
    orgId?: string;
};

export async function getUsersAction(): Promise<UserProfileServer[]> {
    try {
        const querySnapshot = await adminDb.collection('users').get();
        const users: UserProfileServer[] = [];
        querySnapshot.forEach((doc) => {
            users.push({ id: doc.id, ...doc.data() } as UserProfileServer);
        });
        return users;
    } catch (error) {
        console.error('Failed to get users (Admin):', error);
        return [];
    }
}

export async function updateUserAction(uid: string, data: Record<string, any>) {
    if (!uid) {
        return { success: false, message: 'Не указан ID пользователя.' };
    }
    try {
        const userRef = adminDb.collection('users').doc(uid);
        const userSnap = await userRef.get();
        
        if (!userSnap.exists) {
            return { success: false, message: 'Пользователь не найден в базе.' };
        }

        const orgId = userSnap.data()?.orgId;

        const batch = adminDb.batch();

        // 1. Update root /users/{uid}
        batch.update(userRef, data);

        // 2. Update /organizations/{orgId}/staff/{uid}
        if (orgId) {
            const staffRef = adminDb.collection('organizations').doc(orgId).collection('staff').doc(uid);
            
            const staffData: Record<string, any> = {};
            if (data.displayName !== undefined) staffData.name = data.displayName;
            if (data.role !== undefined) staffData.role = data.role;
            if (data.telegramId !== undefined) staffData.telegramId = data.telegramId;
            if (data.locationId !== undefined) staffData.locationId = data.locationId;
            if (data.locationIds !== undefined) staffData.locationIds = data.locationIds;

            const staffDoc = await staffRef.get();
            if (staffDoc.exists && Object.keys(staffData).length > 0) {
                batch.update(staffRef, staffData);
            }
        }

        await batch.commit();

        revalidatePath(`/settings`);
        return { success: true, message: 'Профиль пользователя обновлен.' };
    } catch (error) {
        console.error('Failed to update user (Admin):', error);
        const message = error instanceof Error ? error.message : 'Произошла неизвестная ошибка.';
        return { success: false, message: `Ошибка обновления: ${message}` };
    }
}

export async function updatePosterIntegrationAction(
  orgId: string,
  posterApiUrl: string,
  posterApiKey: string
) {
  if (!orgId) {
    return { success: false, message: 'Не указан ID организации.' };
  }

  const trimmedUrl = posterApiUrl.trim();
  const trimmedKey = posterApiKey.trim();

  if (!trimmedUrl) {
    return { success: false, message: 'Poster API URL не может быть пустым.' };
  }

  if (!trimmedKey) {
    return { success: false, message: 'API Токен не может быть пустым.' };
  }

  // Validate URL format
  try {
    const parsed = new URL(trimmedUrl);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { success: false, message: 'Poster API URL должен начинаться с http:// или https://' };
    }
  } catch {
    return { success: false, message: 'Poster API URL имеет неверный формат.' };
  }

  try {
    const orgRef = adminDb.collection('organizations').doc(orgId);
    await orgRef.set({
      posterApiUrl: trimmedUrl,
      posterApiKey: trimmedKey,
      posterConfiguredAt: new Date(),
      updatedAt: new Date()
    }, { merge: true });

    revalidatePath('/settings');
    revalidatePath('/supplies');
    revalidatePath('/orders');
    return { success: true, message: 'Интеграция с Poster успешно сохранена.' };
  } catch (error) {
    console.error('Failed to update Poster integration:', error);
    const message = error instanceof Error ? error.message : 'Произошла неизвестная ошибка.';
    return { success: false, message: `Ошибка обновления интеграции: ${message}` };
  }
}

export async function changePasswordAction(idToken: string, newPassword: string) {
    if (!idToken || !newPassword) {
        return { success: false, message: 'Не указаны все обязательные данные.' };
    }
    if (newPassword.length < 6) {
        return { success: false, message: 'Пароль должен состоять минимум из 6 символов.' };
    }
    try {
        const decodedToken = await adminAuth.verifyIdToken(idToken);
        const uid = decodedToken.uid;

        // 1. Update password in Firebase Auth
        await adminAuth.updateUser(uid, { password: newPassword });

        // 2. Clean up plaintext password in Firestore if it exists in staff document
        const userRef = adminDb.collection('users').doc(uid);
        const userSnap = await userRef.get();
        if (userSnap.exists) {
            const orgId = userSnap.data()?.orgId;
            if (orgId) {
                const staffRef = adminDb.collection('organizations').doc(orgId).collection('staff').doc(uid);
                const staffDoc = await staffRef.get();
                if (staffDoc.exists) {
                    await staffRef.update({
                        password: '(изменен)',
                        updatedAt: new Date()
                    });
                }
            }
        }

        return { success: true, message: 'Пароль успешно обновлен.' };
    } catch (error: any) {
        console.error('Failed to change password:', error);
        return { success: false, message: error.message || 'Ошибка сервера при смене пароля.' };
    }
}
