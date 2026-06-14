'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import * as Sentry from '@sentry/nextjs';
import { trackEvent } from '@/lib/analytics/events';

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

  const handleLogout = async () => {
    try {
      trackEvent('user_logged_out', {});
      await signOut({ redirect: false });
      router.push('/');
      router.refresh();
    } catch (err) {
      Sentry.captureException(err, { tags: { module: 'auth', action: 'logout' } });
    }
  };

  return (
    <div className="card p-0 overflow-hidden">
      {/* User header */}
      <div className="bg-red-600 text-white px-6 py-5">
        <p className="text-sm opacity-80">Mi cuenta</p>
        <p className="font-bold text-lg truncate">{userName}</p>
      </div>

      {/* Nav items */}
      <nav className="p-2">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
              pathname === item.href
                ? 'bg-red-50 text-red-600'
                : 'text-gray-700 hover:bg-gray-50 hover:text-red-600'
            }`}
          >
            <span>{item.icon}</span>
            {item.label}
          </Link>
        ))}

        <hr className="my-2 border-gray-100" />

        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-red-600 transition-colors text-left"
        >
          <span>🚪</span>
          Cerrar Sesión
        </button>
      </nav>
    </div>
  );
}
