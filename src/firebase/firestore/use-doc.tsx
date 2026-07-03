'use client';

import { useState, useEffect } from 'react';
import {
  DocumentReference,
  onSnapshot,
  getDoc,
  DocumentData,
  FirestoreError,
  DocumentSnapshot,
} from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

/** Utility type to add an 'id' field to a given type T. */
type WithId<T> = T & { id: string };

/**
 * Interface for the return value of the useDoc hook.
 * @template T Type of the document data.
 */
export interface UseDocResult<T> {
  data: WithId<T> | null; // Document data with ID, or null.
  isLoading: boolean;       // True if loading.
  error: FirestoreError | Error | null; // Error object, or null.
  refresh: () => void;      // Force reload data.
}

// Global in-memory cache for single documents
const docCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL_MS = 60 * 1000; // 1 minute

/**
 * React hook to subscribe to a single Firestore document in real-time or once.
 * Handles nullable references.
 * 
 * IMPORTANT! YOU MUST MEMOIZE the inputted memoizedTargetRefOrQuery or BAD THINGS WILL HAPPEN
 * use useMemo to memoize it per React guidence.  Also make sure that it's dependencies are stable
 * references
 *
 * @template T Optional type for document data. Defaults to any.
 * @param {DocumentReference<DocumentData> | null | undefined} memoizedDocRef -
 * The Firestore DocumentReference. Waits if null/undefined.
 * @param {Object} [options] - Options configuration.
 * @param {boolean} [options.once] - If true, fetches once using getDoc instead of subscribing in real-time.
 * @returns {UseDocResult<T>} Object with data, isLoading, error, and refresh.
 */
export function useDoc<T = any>(
  memoizedDocRef: DocumentReference<DocumentData> | null | undefined,
  options?: { once?: boolean }
): UseDocResult<T> {
  type StateDataType = WithId<T> | null;

  const [data, setData] = useState<StateDataType>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<FirestoreError | Error | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);

  const refresh = () => {
    if (memoizedDocRef) {
      docCache.delete(memoizedDocRef.path);
    }
    setRefreshTrigger(prev => prev + 1);
  };

  useEffect(() => {
    if (!memoizedDocRef) {
      setData(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    const cacheKey = memoizedDocRef.path;

    // Check cache
    if (options?.once) {
      const cached = docCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        setData(cached.data);
        setError(null);
        setIsLoading(false);
        return;
      }
    }

    // Execute query once
    if (options?.once) {
      getDoc(memoizedDocRef)
        .then((snapshot) => {
          if (snapshot.exists()) {
            const result = { ...(snapshot.data() as T), id: snapshot.id };
            docCache.set(cacheKey, { data: result, timestamp: Date.now() });
            setData(result);
          } else {
            docCache.set(cacheKey, { data: null, timestamp: Date.now() });
            setData(null);
          }
          setError(null);
          setIsLoading(false);
        })
        .catch((error) => {
          console.error("ACTUAL FIRESTORE ERROR IN useDoc (once):", error);
          setError(error);
          setData(null);
          setIsLoading(false);
        });
      return;
    }

    // Subscribe in real-time
    const unsubscribe = onSnapshot(
      memoizedDocRef,
      (snapshot: DocumentSnapshot<DocumentData>) => {
        if (snapshot.exists()) {
          setData({ ...(snapshot.data() as T), id: snapshot.id });
        } else {
          setData(null);
        }
        setError(null);
        setIsLoading(false);
      },
      (error: FirestoreError) => {
        console.error("ACTUAL FIRESTORE ERROR IN useDoc:", error);
        if (error.code === 'permission-denied') {
          const contextualError = new FirestorePermissionError({
            operation: 'get',
            path: memoizedDocRef.path,
          })
          setError(contextualError)
          setData(null)
          setIsLoading(false)
          errorEmitter.emit('permission-error', contextualError);
        } else {
          setError(error)
          setData(null)
          setIsLoading(false)
          errorEmitter.emit('permission-error', error);
        }
      }
    );

    return () => unsubscribe();
  }, [memoizedDocRef, refreshTrigger]); // Re-run if query or trigger changes.

  return { data, isLoading, error, refresh };
}