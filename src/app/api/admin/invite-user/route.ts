import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/firebase/server';
import * as admin from 'firebase-admin';

function generateTempPassword(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let p1 = '';
  let p2 = '';
  for (let i = 0; i < 3; i++) {
    p1 += chars.charAt(Math.floor(Math.random() * chars.length));
    p2 += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `${p1}-${p2}`;
}

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate caller (Admin)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized: Missing token' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(token);
    
    const adminRole = decodedToken.role || 'employee';
    const adminOrgId = decodedToken.orgId || '';
    const adminLocationIds = decodedToken.locationIds || [];

    // 2. Parse invite payload
    const body = await req.json();
    const { email, role, displayName, locationId, locationIds, orgId: targetOrgId, telegramId } = body;

    if (!email || !role || !displayName) {
      return NextResponse.json({ error: 'Missing required fields: email, role, displayName' }, { status: 400 });
    }

    // 3. Role Hierarchy Validation
    let finalOrgId = '';

    if (adminRole === 'super_admin') {
      // Super admin can invite anyone to any organization, or create a new one
      finalOrgId = targetOrgId || adminDb.collection('organizations').doc().id;
    } else if (adminRole === 'brand_admin') {
      // Brand admin can invite anyone in their own organization
      finalOrgId = adminOrgId;
    } else if (adminRole === 'outlet_admin') {
      // Outlet admin can only invite cashiers or employees
      if (role !== 'cashier' && role !== 'employee') {
        return NextResponse.json({ error: 'Access Denied: Outlet admins can only invite cashiers or employees' }, { status: 403 });
      }
      // Can only invite to their own organization
      finalOrgId = adminOrgId;
      // Must assign to a location they manage
      if (!locationId || !adminLocationIds.includes(locationId)) {
        return NextResponse.json({ error: 'Access Denied: Invited user location must be within admin locationIds' }, { status: 403 });
      }
    } else {
      return NextResponse.json({ error: 'Access Denied: Insufficient permissions to invite' }, { status: 403 });
    }

    // 4. Create brand organization document if it doesn't exist
    const orgRef = adminDb.collection('organizations').doc(finalOrgId);
    const orgSnap = await orgRef.get();
    if (!orgSnap.exists) {
      await orgRef.set({
        id: finalOrgId,
        name: `Brand ${finalOrgId.slice(-6).toUpperCase()}`,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    // 5. Generate Password and Create User in Firebase Auth
    const tempPassword = generateTempPassword();
    const userRecord = await adminAuth.createUser({
      email,
      password: tempPassword,
      displayName,
    });

    // 6. Assign Custom Claims
    const claims = {
      role,
      orgId: finalOrgId,
      locationId: locationId || null,
      locationIds: locationIds || (locationId ? [locationId] : null),
    };
    await adminAuth.setCustomUserClaims(userRecord.uid, claims);

    // 7. Save Profile to root /users/{userId} for legacy compatibility
    const userRef = adminDb.collection('users').doc(userRecord.uid);
    await userRef.set({
      id: userRecord.uid,
      email: email.toLowerCase().trim(),
      displayName: displayName,
      role,
      orgId: finalOrgId,
      telegramId: telegramId ? String(telegramId) : null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // 8. Save Profile to organization staff collection
    const staffRef = adminDb.collection('organizations').doc(finalOrgId).collection('staff').doc(userRecord.uid);
    await staffRef.set({
      id: userRecord.uid,
      name: displayName,
      email,
      role,
      locationId: locationId || null,
      locationIds: locationIds || (locationId ? [locationId] : null),
      status: 'active',
      password: tempPassword, // plaintext for admin view on invite
      telegramId: telegramId ? String(telegramId) : null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return NextResponse.json({
      success: true,
      uid: userRecord.uid,
      email: userRecord.email,
      password: tempPassword,
      role,
      orgId: finalOrgId,
    });

  } catch (error: any) {
    console.error('Invite user API error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
