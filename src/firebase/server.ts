import * as admin from 'firebase-admin';
import { firebaseConfig } from './config';

if (!admin.apps.length) {
  try {
    // Priority 1: Service Account JSON from Environment Variable (Path to file)
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
       admin.initializeApp({
         credential: admin.credential.applicationDefault(),
         storageBucket: firebaseConfig.storageBucket,
       });
    } 
    // Priority 2: Inline Service Account JSON from Env Var (Raw JSON string)
    else if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            storageBucket: firebaseConfig.storageBucket,
        });
    }
    // Priority 3: Application Default Credentials (Standard for Firebase App Hosting / Cloud Run)
    else {
      try {
        admin.initializeApp({
          credential: admin.credential.applicationDefault(),
          projectId: firebaseConfig.projectId,
          storageBucket: firebaseConfig.storageBucket,
        });
      } catch (adcError) {
        console.warn('ADC initialization warning, falling back to base config:', adcError);
        admin.initializeApp({
          projectId: firebaseConfig.projectId,
          storageBucket: firebaseConfig.storageBucket,
        });
      }
    }
    // Apply global settings ONLY on first initialization to avoid hot-reload crashes
    admin.firestore().settings({ ignoreUndefinedProperties: true });
  } catch (error) {
    console.error('Firebase admin initialization error:', error);
  }
}

export const adminDb = admin.firestore();
export const adminAuth = admin.auth();

export function getFirebaseAdmin() {
    return admin;
}
