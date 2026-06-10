'use client';

import { useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { FirebaseContext } from './provider';
import { useCollection as useFirestoreCollection } from './firestore/use-collection';
import { useDoc as useFirestoreDoc } from './firestore/use-doc';

export const useFirebase = () => {
  const context = useContext(FirebaseContext);
  if (context === undefined) {
    throw new Error('useFirebase must be used within a FirebaseProvider');
  }
  return context;
};

export const useAuth = () => {
  const auth = useFirebase().auth;
  if (!auth) throw new Error('Firebase Auth is not initialized');
  return auth;
};

export const useFirestore = () => {
  const db = useFirebase().firestore;
  return db;
};


export const useFirebaseApp = () => {
  const app = useFirebase().firebaseApp;
  if (!app) throw new Error('Firebase App is not initialized');
  return app;
};

export function useUser() {
  const auth = useAuth();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [auth]);

  return { user, loading };
}

// Re-exporting the specific hooks for easier import
export const useCollection = useFirestoreCollection;
export const useDoc = useFirestoreDoc;
