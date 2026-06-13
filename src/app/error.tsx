'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error, {
      tags: {
        module: 'app_error_boundary',
      },
      extra: {
        digest: error.digest,
      },
    });
  }, [error]);

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-6">
      <div className="max-w-md text-center">
        <h2 className="text-2xl font-bold text-gray-900">Algo ha ido mal</h2>
        <p className="mt-3 text-gray-600">Hemos registrado el incidente y lo revisaremos cuanto antes.</p>
        <button
          type="button"
          onClick={reset}
          className="mt-5 rounded-lg bg-red-600 px-4 py-2 text-white font-semibold hover:bg-red-700"
        >
          Reintentar
        </button>
      </div>
    </div>
  );
}
