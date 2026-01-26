'use client';

import { useContext } from 'react';
import { FirebaseContext } from './provider';
import { useCollection as useFirestoreCollection } from './firestore/use-collection';
import { useDoc as useFirestoreDoc } from './firestore/use-doc';
import { useUser as useFirebaseAuthUser } from './auth/use-user';


export const useFirebase = () => {
  const context = useContext(FirebaseContext);
  if (context === undefined) {
    throw new Error('useFirebase must be used within a FirebaseProvider');
  }
  return context;
};

export const useAuth = () => useFirebase().auth;
export const useFirestore = () => useFirebase().firestore;
export const useFirebaseApp = () => useFirebase().app;


// Re-exporting the specific hooks for easier import
export const useCollection = useFirestoreCollection;
export const useDoc = useFirestoreDoc;
export const useUser = useFirebaseAuthUser;
