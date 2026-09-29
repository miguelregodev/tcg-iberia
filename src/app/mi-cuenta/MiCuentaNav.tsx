'use client';

import Link from 'next/link';
import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { useRouter } from 'next/navigation';
import * as Sentry from '@sentry/nextjs';
import { trackEvent } from '@/lib/analytics/events';
import { useB2BSession } from '@/context/B2BSessionContext';
import { signOut } from 'next-auth/react';

interface Props {
  userName: string;
}

const NAV_ITEMS = [
  { href: '/mi-cuenta/datos-personales', label: 'Datos Personales', icon: '👤' },
  { href: '/mi-cuenta/pedidos', label: 'Historial de Pedidos', icon: '📦' },
  { href: '/mi-cuenta/favoritos', label: 'Favoritos', icon: '❤️' },
  { href: '/mi-cuenta/alertas-stock', label: 'Alertas de Stock', icon: '🔔' },
];

export function MiCuentaNav({ userName }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const {isB2B, logout: logoutB2B } = useB2BSession();
  const [isB2BOpen, setIsB2BOpen] = useState(false);


  const handleLogout = async () => {
    try {
      trackEvent('user_logged_out', {});
      setIsB2BOpen(false);
      if (isB2B) {
        setIsB2BOpen(false);
        await logoutB2B();
      } else {
        await signOut({ redirect: false });
      }
      router.push('/');
      router.refresh();
    } catch (err) {
      Sentry.captureException(err, { tags: { module: 'auth', action: 'logout' } });
    }
  };

  return (
    <div className="card p-0 overflow-hidden">
      {/* User header */}
      <div className="bg-dark-bgSecondary border-b border-dark-border text-text-primary px-6 py-5">
        <p className="text-sm text-premium-gold">
          {isB2B ? 'Portal mayorista' : 'Mi cuenta'}
        </p>
        <p className="font-bold text-lg truncate">{userName}</p>
      </div>

      <nav className="p-2">
        {!isB2B && (
          <>
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                  pathname === item.href
                    ? 'bg-premium-gold/15 text-premium-gold'
                    : 'text-text-secondary hover:bg-dark-surfaceHover hover:text-premium-gold'
                }`}
              >
                <span>{item.icon}</span>
                {item.label}
              </Link>
            ))}

            <hr className="my-2 border-dark-border" />
          </>
        )}

        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-text-secondary hover:bg-dark-surfaceHover hover:text-premium-gold transition-colors text-left"
        >
          <span>🚪</span>
          {isB2B ? 'Cerrar sesión B2B' : 'Cerrar Sesión'}
        </button>
      </nav>
    </div>
    
  );
}
