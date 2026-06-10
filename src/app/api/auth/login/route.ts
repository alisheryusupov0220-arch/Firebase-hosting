import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/firebase/server';
import { firebaseConfig } from '@/firebase/config';
import axios from 'axios';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password, telegramId } = body;

    if (!email || !password) {
      return NextResponse.json({ error: 'Missing email or password' }, { status: 400 });
    }

    // 1. Authenticate with Firebase Auth REST API
    const apiKey = firebaseConfig.apiKey;
    const signInUrl = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`;

    let authData;
    try {
      const response = await axios.post(signInUrl, {
        email,
        password,
        returnSecureToken: true,
      });
      authData = response.data;
    } catch (err: any) {
      const fbError = err.response?.data?.error?.message || 'Invalid email or password';
      return NextResponse.json({ error: fbError }, { status: 401 });
    }

    const uid = authData.localId;

    // 2. Locate staff profile by email in Firestore (Collection Group query)
    const staffQuery = adminDb.collectionGroup('staff')
      .where('email', '==', email.toLowerCase().trim())
      .limit(1);
    
    const staffSnap = await staffQuery.get();

    let claims: any = { role: 'employee', orgId: null, locationId: null, locationIds: null };
    let orgId = '';

    if (!staffSnap.empty) {
      const staffDoc = staffSnap.docs[0];
      const staffData = staffDoc.data();
      const pathParts = staffDoc.ref.path.split('/');
      orgId = pathParts[1];

      // Update telegramId in profile if provided
      if (telegramId) {
        await staffDoc.ref.update({
          telegramId: String(telegramId),
          updatedAt: new Date()
        });
      }

      claims = {
        role: staffData.role || 'employee',
        orgId: orgId,
        locationId: staffData.locationId || null,
        locationIds: staffData.locationIds || (staffData.locationId ? [staffData.locationId] : null),
      };

      // Set user claims in Firebase Auth
      await adminAuth.setCustomUserClaims(uid, claims);
    } else {
      // Check root /users/{uid}
      const userRef = adminDb.collection('users').doc(uid);
      const userSnap = await userRef.get();
      if (userSnap.exists) {
        const userData = userSnap.data()!;
        orgId = userData.orgId || '';
        claims = {
          role: userData.role || 'brand_admin',
          orgId: orgId || null,
          locationId: userData.locationId || null,
          locationIds: userData.locationIds || (userData.locationId ? [userData.locationId] : null),
        };
        await adminAuth.setCustomUserClaims(uid, claims);
      }
    }

    // 3. Generate Custom Token
    const customToken = await adminAuth.createCustomToken(uid, claims);

    return NextResponse.json({
      success: true,
      customToken,
      uid,
      role: claims.role,
      orgId: claims.orgId,
    });

  } catch (error: any) {
    console.error('Login API error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
