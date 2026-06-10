import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/firebase/server';
import * as admin from 'firebase-admin';

// Helper to verify caller is super_admin
async function checkSuperAdmin(req: NextRequest) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Unauthorized: Missing token');
  }
  const token = authHeader.split('Bearer ')[1];
  const decodedToken = await adminAuth.verifyIdToken(token);
  if (decodedToken.role !== 'super_admin') {
    throw new Error('Forbidden: Super Admin access required');
  }
  return decodedToken;
}

export async function GET(req: NextRequest) {
  try {
    await checkSuperAdmin(req);
    const orgsSnap = await adminDb.collection('organizations').orderBy('createdAt', 'desc').get();
    const brands = orgsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return NextResponse.json({ success: true, brands });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: error.message.includes('Forbidden') ? 403 : 401 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await checkSuperAdmin(req);
    const body = await req.json();
    const { brandName, adminEmail, adminName, adminPassword } = body;

    if (!brandName || !adminEmail || !adminName || !adminPassword) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const orgId = 'org_' + Math.random().toString(36).substring(2, 10);

    // 1. Create the brand admin user
    const userRecord = await adminAuth.createUser({
      email: adminEmail,
      password: adminPassword,
      displayName: adminName,
    });

    // 2. Set Custom Claims
    const claims = {
      role: 'brand_admin',
      orgId: orgId,
      locationId: null,
      locationIds: null,
    };
    await adminAuth.setCustomUserClaims(userRecord.uid, claims);

    // 3. Create the organization doc
    const orgRef = adminDb.collection('organizations').doc(orgId);
    await orgRef.set({
      id: orgId,
      name: brandName,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // 4. Save root user profile
    await adminDb.collection('users').doc(userRecord.uid).set({
      id: userRecord.uid,
      email: adminEmail.toLowerCase().trim(),
      displayName: adminName,
      role: 'brand_admin',
      orgId: orgId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // 5. Save staff profile
    await orgRef.collection('staff').doc(userRecord.uid).set({
      id: userRecord.uid,
      name: adminName,
      email: adminEmail.toLowerCase().trim(),
      role: 'brand_admin',
      status: 'active',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return NextResponse.json({
      success: true,
      orgId,
      uid: userRecord.uid,
    });

  } catch (error: any) {
    console.error('Super Admin Create Brand error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
