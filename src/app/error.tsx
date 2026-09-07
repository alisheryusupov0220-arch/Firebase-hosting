'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Global error boundary for the app */
export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  useEffect(() => {
    console.error('GlobalError caught:', error);
  }, [error]);

  const handleRefresh = () => {
    reset();
    router.refresh();
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white dark:bg-gray-900 p-4">
      <div className="max-w-2xl rounded-lg border border-red-200 bg-red-50 p-6 shadow-md dark:border-red-900 dark:bg-red-900/20">
        <h2 className="mb-4 text-center text-xl font-semibold text-red-800 dark:text-red-200">
          Что-то пошло не так
        </h2>
        <p className="mb-4 font-mono text-sm text-red-600 dark:text-red-300">
          {error.name}: {error.message}
        </p>
        <div className="mb-4 overflow-auto rounded bg-white p-4 text-xs dark:bg-gray-950 max-h-64">
          <pre className="text-red-800 dark:text-red-200">{error.stack}</pre>
        </div>
        <div className="flex justify-center space-x-4">
          <button
            onClick={handleRefresh}
            className="rounded bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 focus:outline-none"
          >
            Обновить страницу
          </button>
          <button
            onClick={reset}
            className="rounded bg-white px-4 py-2 text-sm font-medium text-red-800 border border-red-200 hover:bg-red-50 focus:outline-none dark:bg-gray-800 dark:text-red-200 dark:border-red-800 dark:hover:bg-gray-700"
          >
            Попробовать ещё раз
          </button>
        </div>
      </div>
    </div>
  );
}
