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
    <div className="flex min-h-screen items-center justify-center bg-white dark:bg-gray-900 p-4">
      <div className="max-w-md rounded-lg border border-gray-200 bg-gray-50 p-6 shadow-md dark:border-gray-700 dark:bg-gray-800">
        <h2 className="mb-4 text-center text-xl font-semibold text-gray-800 dark:text-gray-100">
          Что-то пошло не так
        </h2>
        <p className="mb-4 text-center text-sm text-gray-600 dark:text-gray-300">
          Произошла ошибка: {error.message}
        </p>
        <div className="flex justify-center space-x-4">
          <button
            onClick={handleRefresh}
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none"
          >
            Обновить страницу
          </button>
          <button
            onClick={reset}
            className="rounded bg-gray-300 px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-400 focus:outline-none"
          >
            Попробовать ещё раз
          </button>
        </div>
      </div>
    </div>
  );
}
