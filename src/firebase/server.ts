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
    // Priority 3: Public config only (Will fail for some Admin SDK operations, but good for local startup)
    else {
      admin.initializeApp({
        projectId: firebaseConfig.projectId,
        storageBucket: firebaseConfig.storageBucket,
      });
      console.warn('Firebase Admin initialized with base config. Some write operations may require credentials on local server.');
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
