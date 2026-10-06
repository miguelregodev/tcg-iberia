'use client';

import { useState } from 'react';
import { B2BModal } from './B2BModal';

interface B2BRequestButtonsProps {
  className?: string;
}

/** CTA pair for server-rendered pages that need to open the existing B2B request/login modal. */
export function B2BRequestButtons({ className = '' }: B2BRequestButtonsProps) {
  const [mode, setMode] = useState<'request' | 'login' | null>(null);

  return (
    <>
      <div className={`flex flex-wrap gap-3 ${className}`}>
        <button type="button" onClick={() => setMode('request')} className="btn btn-primary">
          Solicitar cuenta B2B
        </button>
        <button type="button" onClick={() => setMode('login')} className="btn btn-secondary">
          Ya tengo cuenta
        </button>
      </div>
      <B2BModal isOpen={mode !== null} onClose={() => setMode(null)} initialMode={mode ?? 'request'} />
    </>
  );
}
