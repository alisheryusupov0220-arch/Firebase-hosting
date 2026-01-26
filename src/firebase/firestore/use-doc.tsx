'use client';
import { useState, useEffect } from 'react';
import { onSnapshot, doc, DocumentReference, DocumentData, FirestoreError } from 'firebase/firestore';
import { useFirestore } from '@/firebase/hooks';
import { FirestorePermissionError } from '../errors';
import { errorEmitter } from '../error-emitter';

export function useDoc(ref: DocumentReference | null) {
  const [data, setData] = useState<DocumentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<FirestoreError | FirestorePermissionError | null>(null);

  useEffect(() => {
    if (!ref) {
      setData(null);
      setLoading(false);
      return;
    }
    
    setLoading(true);

    const unsubscribe = onSnapshot(ref, 
      (docSnapshot) => {
        if (docSnapshot.exists()) {
          setData({ id: docSnapshot.id, ...docSnapshot.data() });
        } else {
          setData(null);
        }
        setLoading(false);
        setError(null);
      }, 
      (err) => {
        console.error("Error fetching document:", err);
        if (err.code === 'permission-denied') {
            const permissionError = new FirestorePermissionError({
                path: ref.path,
                operation: 'get',
            });
            errorEmitter.emit('permission-error', permissionError);
            setError(permissionError);
        } else {
            setError(err);
        }
        setData(null);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [ref]);

  return { data, loading, error };
}
