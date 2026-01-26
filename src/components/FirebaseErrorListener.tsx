'use client';

import { useEffect } from 'react';
import { errorEmitter } from '@/firebase/error-emitter';

// This is a client-side only component that listens for Firebase errors
// and throws them to be caught by the Next.js error overlay.
// This is used for development purposes to get more detailed error messages.
export function FirebaseErrorListener() {
  useEffect(() => {
    const handleError = (error: Error) => {
      // Throw the error so Next.js can handle it.
      // In a production environment, you might want to log this to a service.
      throw error;
    };

    errorEmitter.on('permission-error', handleError);

    return () => {
      errorEmitter.off('permission-error', handleError);
    };
  }, []);

  return null;
}
