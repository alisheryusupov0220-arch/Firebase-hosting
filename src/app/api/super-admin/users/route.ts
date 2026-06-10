import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/firebase/server';

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
    const usersSnap = await adminDb.collection('users').get();
    const users = usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return NextResponse.json({ success: true, users });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: error.message.includes('Forbidden') ? 403 : 401 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await checkSuperAdmin(req);
    const { searchParams } = new URL(req.url);
    const uid = searchParams.get('uid');

    if (!uid) {
      return NextResponse.json({ error: 'Missing uid parameter' }, { status: 400 });
    }

    // Get user profile first to find their orgId
    const userRef = adminDb.collection('users').doc(uid);
    const userSnap = await userRef.get();
    
    if (userSnap.exists) {
      const userData = userSnap.data()!;
      const orgId = userData.orgId;
      
      // Delete organization staff record
      if (orgId) {
        await adminDb.collection('organizations').doc(orgId).collection('staff').doc(uid).delete();
      }
      
      // Delete root user record
      await userRef.delete();
    }

    // Delete in Firebase Auth
    await adminAuth.deleteUser(uid);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Super Admin Delete User error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
