'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { LoginModal } from '@/components/LoginModal';

export function HomeClient() {
  const searchParams = useSearchParams();
  const [isLoginOpen, setIsLoginOpen] = useState(false);

  useEffect(() => {
    if (searchParams.get('login') === '1') {
      setIsLoginOpen(true);
    }
  }, [searchParams]);

  return <LoginModal isOpen={isLoginOpen} onClose={() => setIsLoginOpen(false)} />;
}
