import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/firebase/server';
import * as admin from 'firebase-admin';

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized: Missing token' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(token);
    const uid = decodedToken.uid;
    const email = decodedToken.email || '';

    // 1. Look up existing profile in root /users/{uid}
    const userRef = adminDb.collection('users').doc(uid);
    const userSnap = await userRef.get();

    let claims: any = null;

    if (userSnap.exists) {
      const userData = userSnap.data()!;
      claims = {
        role: userData.role || 'employee',
        orgId: userData.orgId || null,
        locationId: userData.locationId || null,
        locationIds: userData.locationIds || (userData.locationId ? [userData.locationId] : null),
      };
    } else {
      // 2. Profile not found in /users. Let's check staff subcollection by email (Collection Group query)
      const staffQuery = adminDb.collectionGroup('staff')
        .where('email', '==', email.toLowerCase().trim())
        .limit(1);
      const staffSnap = await staffQuery.get();

      if (!staffSnap.empty) {
        const staffDoc = staffSnap.docs[0];
        const staffData = staffDoc.data();
        const pathParts = staffDoc.ref.path.split('/');
        const orgId = pathParts[1];

        claims = {
          role: staffData.role || 'employee',
          orgId: orgId,
          locationId: staffData.locationId || null,
          locationIds: staffData.locationIds || (staffData.locationId ? [staffData.locationId] : null),
        };

        // Create root profile for legacy compatibility
        await userRef.set({
          id: uid,
          email: email.toLowerCase().trim(),
          displayName: decodedToken.name || email.split('@')[0],
          role: claims.role,
          orgId: claims.orgId,
          locationId: claims.locationId,
          locationIds: claims.locationIds,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      } else {
        // 3. New user entirely! Provision a new organization and brand_admin role (Google register flow)
        const orgId = 'org_' + Math.random().toString(36).substring(2, 10);
        claims = {
          role: 'brand_admin',
          orgId: orgId,
          locationId: null,
          locationIds: null,
        };

        // Create the organization
        const orgRef = adminDb.collection('organizations').doc(orgId);
        await orgRef.set({
          id: orgId,
          name: `Компания ${decodedToken.name || email.split('@')[0]}`,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Save root profile
        await userRef.set({
          id: uid,
          email: email.toLowerCase().trim(),
          displayName: decodedToken.name || email.split('@')[0],
          role: 'brand_admin',
          orgId: orgId,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Save staff profile
        await orgRef.collection('staff').doc(uid).set({
          id: uid,
          name: decodedToken.name || email.split('@')[0],
          email: email.toLowerCase().trim(),
          role: 'brand_admin',
          status: 'active',
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
    }

    // Write claims to Firebase Auth
    await adminAuth.setCustomUserClaims(uid, claims);

    return NextResponse.json({
      success: true,
      claims,
    });

  } catch (error: any) {
    console.error('Sync claims error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
