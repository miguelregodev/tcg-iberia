'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error, {
      tags: {
        module: 'global_error_boundary',
      },
      extra: {
        digest: error.digest,
      },
    });
  }, [error]);

  return (
    <html lang="en">
      <body>
        <div className="min-h-screen bg-dark-bg flex items-center justify-center p-6">
          <div className="max-w-md text-center">
            <h2 className="text-2xl font-bold text-text-primary">Error crítico de la aplicación</h2>
            <p className="mt-3 text-text-secondary">Hemos registrado este error y nuestro equipo lo revisará.</p>
            <button
              type="button"
              onClick={reset}
              className="mt-5 btn btn-primary"
            >
              Intentar de nuevo
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
