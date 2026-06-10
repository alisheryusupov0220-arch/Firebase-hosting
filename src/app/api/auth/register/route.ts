import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/firebase/server';
import * as admin from 'firebase-admin';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password, displayName } = body;

    if (!email || !password) {
      return NextResponse.json({ error: 'Missing email or password' }, { status: 400 });
    }

    const name = displayName || email.split('@')[0];
    const orgId = 'org_' + Math.random().toString(36).substring(2, 10);

    // 1. Create the user in Firebase Auth
    const userRecord = await adminAuth.createUser({
      email,
      password,
      displayName: name,
    });

    // 2. Set Custom Claims for brand_admin
    const claims = {
      role: 'brand_admin',
      orgId: orgId,
      locationId: null,
      locationIds: null,
    };
    await adminAuth.setCustomUserClaims(userRecord.uid, claims);

    // 3. Create the organization document
    const orgRef = adminDb.collection('organizations').doc(orgId);
    await orgRef.set({
      id: orgId,
      name: `Компания ${name}`,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // 4. Save profile to root /users/{userId} for legacy compatibility
    const userRef = adminDb.collection('users').doc(userRecord.uid);
    await userRef.set({
      id: userRecord.uid,
      email: email.toLowerCase().trim(),
      name: name,
      displayName: name,
      role: 'brand_admin',
      orgId: orgId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });


    // 5. Save profile to /organizations/{orgId}/staff/{userId}
    const staffRef = orgRef.collection('staff').doc(userRecord.uid);
    await staffRef.set({
      id: userRecord.uid,
      name: name,
      email: email.toLowerCase().trim(),
      role: 'brand_admin',
      status: 'active',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return NextResponse.json({
      success: true,
      uid: userRecord.uid,
      email: userRecord.email,
      orgId: orgId,
    });

  } catch (error: any) {
    console.error('Registration API error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
