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
    <div className="min-h-screen bg-dark-bg flex items-center justify-center p-6">
      <div className="max-w-md text-center">
        <h2 className="text-2xl font-bold text-text-primary">Algo ha ido mal</h2>
        <p className="mt-3 text-text-secondary">Hemos registrado el incidente y lo revisaremos cuanto antes.</p>
        <button
          type="button"
          onClick={reset}
          className="mt-5 btn btn-primary"
        >
          Reintentar
        </button>
      </div>
    </div>
  );
}
