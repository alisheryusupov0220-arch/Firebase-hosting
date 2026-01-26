import { initializeApp, getApp, getApps, type FirebaseOptions } from 'firebase/app';
import { firebaseConfig } from './config';

let app;

// This function is for server-side use (e.g., in Server Actions)
// It ensures that we're not re-initializing the app on every server call.
export function getFirebaseApp(config: FirebaseOptions = firebaseConfig) {
  if (getApps().length === 0) {
    app = initializeApp(config);
  } else {
    app = getApp();
  }
  return app;
}
