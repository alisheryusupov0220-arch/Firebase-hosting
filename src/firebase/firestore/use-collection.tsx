'use client';

import { useState, useEffect } from 'react';
import {
  Query,
  onSnapshot,
  getDocs,
  DocumentData,
  FirestoreError,
  QuerySnapshot,
  CollectionReference,
  query,
  where,
} from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { useFirebase } from '../provider';

/** Utility type to add an 'id' field to a given type T. */
export type WithId<T> = T & { id: string };

/**
 * Interface for the return value of the useCollection hook.
 * @template T Type of the document data.
 */
export interface UseCollectionResult<T> {
  data: WithId<T>[] | null; // Document data with ID, or null.
  isLoading: boolean;       // True if loading.
  error: FirestoreError | Error | null; // Error object, or null.
  refresh: () => void;      // Force reload data.
}

/* Internal implementation of Query:
  https://github.com/firebase/firebase-js-sdk/blob/c5f08a9bc5da0d2b0207802c972d53724ccef055/packages/firestore/src/lite-api/reference.ts#L143
*/
export interface InternalQuery extends Query<DocumentData> {
  _query: {
    path: {
      canonicalString(): string;
      toString(): string;
    }
  }
}

// Global in-memory cache for one-time queries
const collectionCache = new Map<string, { data: any[]; timestamp: number }>();
const CACHE_TTL_MS = 60 * 1000; // 1 minute

/**
 * React hook to subscribe to a Firestore collection or query in real-time or once.
 * Handles nullable references/queries.
 * 
 * IMPORTANT! YOU MUST MEMOIZE the inputted memoizedTargetRefOrQuery or BAD THINGS WILL HAPPEN
 * use useMemo to memoize it per React guidence.  Also make sure that it's dependencies are stable
 * references
 *  
 * @template T Optional type for document data. Defaults to any.
 * @param {CollectionReference<DocumentData> | Query<DocumentData> | null | undefined} targetRefOrQuery -
 * The Firestore CollectionReference or Query. Waits if null/undefined.
 * @param {Object} [options] - Options configuration.
 * @param {boolean} [options.once] - If true, fetches once using getDocs instead of subscribing in real-time.
 * @returns {UseCollectionResult<T>} Object with data, isLoading, error, and refresh.
 */
export function useCollection<T = any>(
    memoizedTargetRefOrQuery: ((CollectionReference<DocumentData> | Query<DocumentData>) & {__memo?: boolean})  | null | undefined,
    options?: { once?: boolean }
): UseCollectionResult<T> {
  type ResultItemType = WithId<T>;
  type StateDataType = ResultItemType[] | null;

  const { orgId, role } = useFirebase();
  const [data, setData] = useState<StateDataType>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<FirestoreError | Error | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);

  const refresh = () => {
    if (memoizedTargetRefOrQuery) {
      const path = memoizedTargetRefOrQuery.type === 'collection'
        ? (memoizedTargetRefOrQuery as CollectionReference).path
        : (memoizedTargetRefOrQuery as unknown as InternalQuery)._query.path.canonicalString();
      
      // Delete any variations of this collection in cache
      collectionCache.delete(path);
      for (const key of collectionCache.keys()) {
        if (key.startsWith(path)) {
          collectionCache.delete(key);
        }
      }
    }
    setRefreshTrigger(prev => prev + 1);
  };

  useEffect(() => {
    if (!memoizedTargetRefOrQuery) {
      setData(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    let finalQuery: CollectionReference<DocumentData> | Query<DocumentData> = memoizedTargetRefOrQuery;

    if (orgId && role !== 'super_admin') {
      const path: string =
        memoizedTargetRefOrQuery.type === 'collection'
          ? (memoizedTargetRefOrQuery as CollectionReference).path
          : (memoizedTargetRefOrQuery as unknown as InternalQuery)._query.path.canonicalString();

      const isolatedCollections: string[] = [];

      const isIsolated = isolatedCollections.some(col => path.includes(col));
      if (isIsolated) {
        finalQuery = query(memoizedTargetRefOrQuery, where('orgId', '==', orgId));
      }
    }

    const cacheKey = finalQuery.type === 'collection'
      ? (finalQuery as CollectionReference).path
      : (finalQuery as unknown as InternalQuery)._query.path.canonicalString();

    // Check cache
    if (options?.once) {
      const cached = collectionCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        setData(cached.data);
        setError(null);
        setIsLoading(false);
        return;
      }
    }

    // Execute query once
    if (options?.once) {
      getDocs(finalQuery)
        .then((snapshot) => {
          const results: ResultItemType[] = [];
          for (const doc of snapshot.docs) {
            results.push({ ...(doc.data() as T), id: doc.id });
          }
          collectionCache.set(cacheKey, { data: results, timestamp: Date.now() });
          setData(results);
          setError(null);
          setIsLoading(false);
        })
        .catch((error) => {
          console.error("ACTUAL FIRESTORE ERROR IN useCollection (once):", error);
          setError(error);
          setData(null);
          setIsLoading(false);
        });
      return;
    }

    // Subscribe in real-time
    const unsubscribe = onSnapshot(
      finalQuery,
      (snapshot: QuerySnapshot<DocumentData>) => {
        const results: ResultItemType[] = [];
        for (const doc of snapshot.docs) {
          results.push({ ...(doc.data() as T), id: doc.id });
        }
        setData(results);
        setError(null);
        setIsLoading(false);
      },
      (error: FirestoreError) => {
        console.error("ACTUAL FIRESTORE ERROR IN useCollection:", error);
        
        // This logic extracts the path from either a ref or a query
        const path: string =
          memoizedTargetRefOrQuery.type === 'collection'
            ? (memoizedTargetRefOrQuery as CollectionReference).path
            : (memoizedTargetRefOrQuery as unknown as InternalQuery)._query.path.canonicalString()

        if (error.code === 'permission-denied') {
          const contextualError = new FirestorePermissionError({
            operation: 'list',
            path,
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
  }, [memoizedTargetRefOrQuery, refreshTrigger]); // Re-run if query or trigger changes

  if(memoizedTargetRefOrQuery && !memoizedTargetRefOrQuery.__memo) {
    throw new Error(memoizedTargetRefOrQuery + ' was not properly memoized using useMemoFirebase');
  }
  return { data, isLoading, error, refresh };
}