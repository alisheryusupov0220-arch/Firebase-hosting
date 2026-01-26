'use client';
import { useState, useEffect } from 'react';
import { onSnapshot, query, collection, Query, DocumentData, FirestoreError } from 'firebase/firestore';
import { useFirestore } from '@/firebase/hooks';
import { FirestorePermissionError } from '../errors';
import { errorEmitter } from '../error-emitter';


export function useCollection(q: Query | null) {
  const [data, setData] = useState<DocumentData[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<FirestoreError | FirestorePermissionError | null>(null);

  useEffect(() => {
    if (!q) {
      setData([]);
      setLoading(false);
      return;
    }
    
    setLoading(true);

    const unsubscribe = onSnapshot(q, 
      (querySnapshot) => {
        const docs: DocumentData[] = [];
        querySnapshot.forEach((doc) => {
          docs.push({ id: doc.id, ...doc.data() });
        });
        setData(docs);
        setLoading(false);
        setError(null);
      }, 
      (err: FirestoreError) => {
        console.error("Error fetching collection:", err);

        if (err.code === 'permission-denied') {
            const permissionError = new FirestorePermissionError({
                path: (q as any)._query.path.segments.join('/'),
                operation: 'list',
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
  }, [q]);

  return { data, loading, error };
}
