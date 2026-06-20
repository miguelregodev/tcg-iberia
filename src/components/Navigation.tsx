'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import * as Sentry from '@sentry/nextjs';
import { HamburgerMenu } from './HamburgerMenu';
import { useCart } from '@/context/CartContext';
import { ShoppingCartModal } from './ShoppingCartModal';
import { LoginModal } from './LoginModal';
import { trackEvent } from '@/lib/analytics/events';
import { FreeShippingProgress } from './FreeShippingProgress';
import { getFreeShippingState } from '@/lib/shipping/free-shipping';
import { useMemo } from 'react';
import { AnnouncementBannerBar } from './AnnouncementBannerBar';

const ACCOUNT_LINKS = [
  { href: '/mi-cuenta/pedidos', label: 'Historial de Pedidos', icon: '📦' },
  { href: '/mi-cuenta/favoritos', label: 'Favoritos', icon: '❤️' },
  { href: '/mi-cuenta/alertas-stock', label: 'Alertas de Stock', icon: '🔔' },
];

export function Navigation() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const { totalQuantity, totalPrice } = useCart();
  const { data: session } = useSession();
  const router = useRouter();
  const menuWrapperRef = useRef<HTMLDivElement>(null);
  const accountWrapperRef = useRef<HTMLDivElement>(null);
  const freeShippingState = useMemo(() => getFreeShippingState(totalPrice), [totalPrice]);

  // Close hamburger on outside click / Escape.
  useEffect(() => {
    if (!isMenuOpen) return;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (menuWrapperRef.current && target && !menuWrapperRef.current.contains(target)) {
        setIsMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsMenuOpen(false);
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMenuOpen]);

  // Close account dropdown on outside click / Escape.
  useEffect(() => {
    if (!isAccountOpen) return;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (accountWrapperRef.current && target && !accountWrapperRef.current.contains(target)) {
        setIsAccountOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsAccountOpen(false);
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isAccountOpen]);

  const handleLogout = async () => {
    setIsAccountOpen(false);
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
    <>
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
        <div className="container-custom px-4 py-4 flex justify-center items-center relative">
          {/* Hamburger Menu - Left */}
          <div ref={menuWrapperRef} className="absolute left-4">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="relative w-10 h-10 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors group"
              aria-label="Toggle menu"
              aria-expanded={isMenuOpen}
            >
              <span className="sr-only">Toggle menu</span>
              <span
                className={`absolute h-0.5 w-6 rounded-full bg-gray-700 group-hover:bg-red-600 transition-all duration-300 ease-out ${
                  isMenuOpen ? 'rotate-45 translate-y-0' : '-translate-y-2'
                }`}
              />
              <span
                className={`absolute h-0.5 w-6 rounded-full bg-gray-700 group-hover:bg-red-600 transition-all duration-300 ease-out ${
                  isMenuOpen ? 'opacity-0 scale-x-0' : 'opacity-100 scale-x-100'
                }`}
              />
              <span
                className={`absolute h-0.5 w-6 rounded-full bg-gray-700 group-hover:bg-red-600 transition-all duration-300 ease-out ${
                  isMenuOpen ? '-rotate-45 translate-y-0' : 'translate-y-2'
                }`}
              />
            </button>

            {/* Dropdown panel — anchored under the hamburger button */}
            {isMenuOpen && (
              <div className="absolute left-0 top-full mt-2 w-72 sm:w-80">
                <HamburgerMenu onClose={() => setIsMenuOpen(false)} />
              </div>
            )}
          </div>

          {/* Centered Logo & Brand */}
          <Link href="/" className="flex items-center gap-2">
            <img src="/images/logo.png" alt="TCG Iberia" className="h-10 w-auto" />
            <span className="text-lg md:text-2xl font-bold text-red-600">TCG Iberia</span>
          </Link>

          {/* Right side: Login / Account + Shopping Bag */}
          <div className="absolute right-4 flex items-center gap-1">
            {/* Login / Account button */}
            {session?.user ? (
              <div ref={accountWrapperRef} className="relative">
                <button
                  onClick={() => setIsAccountOpen((v) => !v)}
                  className="relative p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  aria-label="Mi cuenta"
                  aria-expanded={isAccountOpen}
                >
                  <img src="/images/login.png" alt="Mi cuenta" className="w-6 h-6" />
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-green-500 border border-white rounded-full" />
                </button>

                {isAccountOpen && (
                  <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-50 animate-fadeIn">
                    {/* User header */}
                    <div className="px-4 py-3 bg-red-600 text-white">
                      <p className="text-xs opacity-80">Mi cuenta</p>
                      <p className="font-bold text-sm truncate">
                        {session.user.name?.split(' ')[0] ?? session.user.email?.split('@')[0]}
                      </p>
                    </div>

                    {/* Links */}
                    <nav className="p-1">
                      {ACCOUNT_LINKS.map((item) => (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setIsAccountOpen(false)}
                          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-700 hover:bg-red-50 hover:text-red-600 transition-colors"
                        >
                          <span>{item.icon}</span>
                          {item.label}
                        </Link>
                      ))}

                      <hr className="my-1 border-gray-100" />

                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-700 hover:bg-red-50 hover:text-red-600 transition-colors text-left"
                      >
                        <span>🚪</span>
                        Cerrar Sesión
                      </button>
                    </nav>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={() => setIsLoginOpen(true)}
                className="relative p-2 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label="Iniciar sesión"
              >
                <img src="/images/login.png" alt="Iniciar sesión" className="w-6 h-6" />
              </button>
            )}

            {/* Shopping Bag */}
            <button
              onClick={() => setIsCartOpen(true)}
              className="relative p-2 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Shopping cart"
            >
              <img
                src="/images/shopping-bag.png"
                alt="Shopping Cart"
                className="w-6 h-6"
              />
              {totalQuantity > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-600 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
                  {totalQuantity}
                </span>
              )}
            </button>
          </div>
        </div>
      </nav>

      {/* Dynamic Announcement Banner — always visible when banners exist */}
      <AnnouncementBannerBar />

      {/* Free Shipping Progress Banner — only visible when cart has items */}
      {totalQuantity > 0 && (
        <div className="bg-white border-b border-gray-200 shadow-sm">
          <div className="container-custom px-4 py-1.5">
            <FreeShippingProgress
              state={freeShippingState}
              context="cart"
              className="!bg-transparent !border-0 !p-0"
            />
          </div>
        </div>
      )}

      {/* Shopping Cart Modal */}
      <ShoppingCartModal isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />

      {/* Login Modal */}
      <LoginModal isOpen={isLoginOpen} onClose={() => setIsLoginOpen(false)} />
    </>
  );
}