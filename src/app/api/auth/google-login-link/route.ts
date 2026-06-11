import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/firebase/server';
import axios from 'axios';

export async function POST(req: NextRequest) {
  try {
    const { idToken } = await req.json();
    if (!idToken) {
      return NextResponse.json({ error: 'Missing Google ID Token' }, { status: 400 });
    }

    // Verify Google ID token via Google's tokeninfo API
    let payload;
    try {
      const response = await axios.get(`https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`);
      payload = response.data;
    } catch (err: any) {
      console.error('Google token verification failed:', err.response?.data || err.message);
      return NextResponse.json({ error: 'Неверный Google ID токен' }, { status: 400 });
    }

    if (!payload.email_verified || payload.email_verified !== 'true') {
      return NextResponse.json({ error: 'Google email не подтвержден' }, { status: 400 });
    }

    const email = payload.email.toLowerCase().trim();

    // Check if user exists in Firebase Auth by email
    let userRecord;
    try {
      userRecord = await adminAuth.getUserByEmail(email);
    } catch (error: any) {
      if (error.code === 'auth/user-not-found') {
        return NextResponse.json({ error: 'Пользователь с такой почтой не найден в системе.' }, { status: 404 });
      }
      throw error;
    }

    // Generate Firebase Custom Token for the existing user UID
    // Pass the existing custom claims if they exist, to prevent loss of claims during sign in
    const claims = userRecord.customClaims || {};
    const customToken = await adminAuth.createCustomToken(userRecord.uid, claims);

    return NextResponse.json({
      success: true,
      customToken,
    });
  } catch (error: any) {
    console.error('Google login link API error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
