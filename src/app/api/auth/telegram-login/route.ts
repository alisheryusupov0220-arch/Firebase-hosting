import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/firebase/server';
import { verifyTelegramWebAppData } from '@/lib/telegram-auth';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { initData } = body;

    if (!initData) {
      return NextResponse.json({ error: 'Missing initData' }, { status: 400 });
    }

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      console.error('Missing TELEGRAM_BOT_TOKEN environment variable');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    // 1. Verify Telegram Web App signature
    const isValid = verifyTelegramWebAppData(initData, botToken);
    if (!isValid) {
      return NextResponse.json({ error: 'Unauthorized: Invalid Telegram signature' }, { status: 401 });
    }

    // 2. Parse Telegram user info
    const params = new URLSearchParams(initData);
    const userRaw = params.get('user');
    if (!userRaw) {
      return NextResponse.json({ error: 'Missing user object in initData' }, { status: 400 });
    }

    const tgUser = JSON.parse(userRaw);
    const telegramId = String(tgUser.id);

    // 3. Search staff member by telegramId across all organizations (Collection Group query)
    const staffQuery = adminDb.collectionGroup('staff')
      .where('telegramId', '==', telegramId)
      .limit(1);
    
    const staffSnap = await staffQuery.get();

    if (staffSnap.empty) {
      // Scenario B: User not bound yet
      return NextResponse.json({ 
        success: false, 
        status: 'NOT_BOUND', 
        telegramId 
      });
    }

    // Scenario A: User found - Generate custom token with claims
    const staffDoc = staffSnap.docs[0];
    const staffData = staffDoc.data();
    const uid = staffDoc.id;
    
    // Extract orgId from document path: "organizations/{orgId}/staff/{userId}"
    const pathParts = staffDoc.ref.path.split('/');
    const orgId = pathParts[1];

    const claims = {
      role: staffData.role || 'employee',
      orgId: orgId,
      locationId: staffData.locationId || null,
      locationIds: staffData.locationIds || (staffData.locationId ? [staffData.locationId] : null),
    };

    // Update claims in Auth
    await adminAuth.setCustomUserClaims(uid, claims);

    // Generate custom JWT token for Firebase Client login
    const customToken = await adminAuth.createCustomToken(uid, claims);

    return NextResponse.json({
      success: true,
      customToken,
      uid,
      role: claims.role,
      orgId: claims.orgId,
    });

  } catch (error: any) {
    console.error('Telegram login API error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
