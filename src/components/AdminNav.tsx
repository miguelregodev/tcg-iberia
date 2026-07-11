'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

const NAV_LINKS = [
  { href: '/admin/orders', label: 'Pedidos' },
  { href: '/admin/products', label: 'Productos' },
  { href: '/admin/banners', label: 'Banners' },
  { href: '/admin/price-import', label: 'Precios' },
  { href: '/admin/b2b', label: 'B2B' },
];

export function AdminNav() {
  const router = useRouter();
  const pathname = usePathname();

  const handleLogout = async () => {
    await fetch('/api/admin/auth/logout', { method: 'POST' });
    router.push('/admin/login');
  };

  return (
    <nav className="bg-white border-b border-gray-200">
      <div className="container-custom px-4 py-4 flex justify-between items-center gap-4">
        <div className="flex items-center gap-8">
          <Link
            href="/admin/orders"
            className="text-2xl font-bold text-red-600"
          >
            Admin Panel
          </Link>
          <div className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map((link) => {
              const active =
                pathname === link.href || pathname?.startsWith(`${link.href}/`);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    active
                      ? 'bg-red-50 text-red-600'
                      : 'text-gray-600 hover:text-red-600 hover:bg-gray-50'
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="btn btn-secondary text-sm"
        >
          Logout
        </button>
      </div>
    </nav>
  );
}