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
import { B2BModal } from './B2BModal';
import { useB2BSession } from '@/context/B2BSessionContext';
import { trackEvent } from '@/lib/analytics/events';
import { FreeShippingProgress } from './FreeShippingProgress';
import { getFreeShippingState } from '@/lib/shipping/free-shipping';
import { useMemo } from 'react';
import { AnnouncementBannerBar } from './AnnouncementBannerBar';
import { SearchPanel, type SearchPanelHandle } from './SearchPanel';
import { DesktopNavMenu } from './DesktopNavMenu';

const ACCOUNT_LINKS = [
  { href: '/mi-cuenta/pedidos', label: 'Historial de Pedidos', icon: '📦' },
  { href: '/mi-cuenta/favoritos', label: 'Favoritos', icon: '❤️' },
  { href: '/mi-cuenta/alertas-stock', label: 'Alertas de Stock', icon: '🔔' },
];

export function Navigation() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isB2BOpen, setIsB2BOpen] = useState(false);
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const { totalQuantity, totalPrice } = useCart();
  const { data: session } = useSession();
  const { customer: b2bCustomer, isB2B, logout: logoutB2B } = useB2BSession();
  const router = useRouter();
  const menuWrapperRef = useRef<HTMLDivElement>(null);
  const accountWrapperRef = useRef<HTMLDivElement>(null);
  const searchPanelRef = useRef<SearchPanelHandle>(null);
  const freeShippingState = useMemo(() => getFreeShippingState(totalPrice), [totalPrice]);

  // Focus the search input the moment the panel opens (waits a tick so the
  // entrance transition does not steal the focus animation).
  useEffect(() => {
    if (!isSearchOpen) return;
    const handle = window.requestAnimationFrame(() => {
      searchPanelRef.current?.focusInput();
    });
    return () => window.cancelAnimationFrame(handle);
  }, [isSearchOpen]);

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
      {/* Top Bar: Logo centered + hamburger/search on left (mobile), search/login/cart on right */}
      <nav className="bg-dark-bg/95 backdrop-blur border-b border-dark-border sticky top-0 z-50">
        <div className="container-custom px-2 sm:px-4 py-3 md:py-4 flex items-center justify-center gap-2 md:gap-6 relative">
          {/* Left: Hamburger (mobile only) */}
          <div className="absolute left-1 sm:left-4 flex md:hidden items-center gap-0.5 sm:gap-1">
            <div ref={menuWrapperRef} className="relative">
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="relative w-10 h-10 flex items-center justify-center rounded-lg hover:bg-dark-surfaceHover transition-colors group"
                aria-label="Toggle menu"
                aria-expanded={isMenuOpen}
              >
                <span className="sr-only">Toggle menu</span>
                <span
                  className={`absolute h-0.5 w-6 rounded-full bg-text-secondary group-hover:bg-premium-gold transition-all duration-300 ease-out ${
                    isMenuOpen ? 'rotate-45 translate-y-0 bg-premium-gold' : '-translate-y-2'
                  }`}
                />
                <span
                  className={`absolute h-0.5 w-6 rounded-full bg-text-secondary group-hover:bg-premium-gold transition-all duration-300 ease-out ${
                    isMenuOpen ? 'opacity-0 scale-x-0' : 'opacity-100 scale-x-100'
                  }`}
                />
                <span
                  className={`absolute h-0.5 w-6 rounded-full bg-text-secondary group-hover:bg-premium-gold transition-all duration-300 ease-out ${
                    isMenuOpen ? '-rotate-45 translate-y-0 bg-premium-gold' : 'translate-y-2'
                  }`}
                />
              </button>

              {/* Dropdown panel — anchored under the hamburger button */}
              {isMenuOpen && (
                <div className="absolute left-0 top-full mt-2 w-72 sm:w-80">
                  <HamburgerMenu
                    onClose={() => setIsMenuOpen(false)}
                    onOpenB2B={() => setIsB2BOpen(true)}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Centered Logo & Brand */}
          <Link href="/" className="flex items-center gap-2 flex-shrink-0">
            <img src="/images/logo.png" alt="TCG Iberia" className="h-10 w-auto" />
            <span className="hidden sm:inline text-lg md:text-2xl font-bold text-premium-gold">TCG Iberia</span>
          </Link>

          {/* Right side: Search + Login / Account + Shopping Bag */}
          <div className="absolute right-1 sm:right-4 flex items-center gap-0.5 sm:gap-1">
            {/* Search toggle */}
            <button
              type="button"
              data-search-trigger
              onClick={() => setIsSearchOpen((v) => !v)}
              className="flex relative p-2 hover:bg-dark-surfaceHover rounded-lg transition-colors"
              aria-label={isSearchOpen ? 'Cerrar búsqueda' : 'Abrir búsqueda'}
              aria-expanded={isSearchOpen}
              aria-controls="global-search-panel"
            >
              <img
                src="/images/search.png"
                alt=""
                aria-hidden="true"
                className="w-6 h-6 icon-invert opacity-80"
              />
            </button>

            {/* Login / Account button */}
            {isB2B ? (
              <div ref={accountWrapperRef} className="relative">
                <button
                  onClick={() => setIsAccountOpen((v) => !v)}
                  className="relative p-2 hover:bg-dark-surfaceHover rounded-lg transition-colors"
                  aria-label="Cuenta B2B"
                  aria-expanded={isAccountOpen}
                >
                  <img src="/images/login.png" alt="Cuenta B2B" className="w-6 h-6 icon-invert opacity-90" />
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-premium-gold border border-dark-bg rounded-full" />
                </button>

                {isAccountOpen && (
                  <div className="absolute right-0 top-full mt-2 w-64 bg-dark-surface rounded-xl shadow-elevated border border-dark-border overflow-hidden z-[9999] animate-fadeIn">
                    {/* B2B header */}
                    <div className="px-4 py-3 bg-dark-bgSecondary border-b border-dark-border">
                      <p className="text-[10px] tracking-widest text-premium-gold uppercase font-semibold">
                        Portal mayorista
                      </p>
                      <p className="font-bold text-sm truncate text-text-primary">
                        {b2bCustomer?.companyName ?? 'Cliente B2B'}
                      </p>
                      {b2bCustomer?.contactName && (
                        <p className="text-xs text-text-secondary truncate">
                          {b2bCustomer.contactName}
                        </p>
                      )}
                    </div>

                    {/* Links */}
                    <nav className="p-1">
                      <Link
                        href="/mi-cuenta/b2b/perfil"
                        onClick={() => setIsAccountOpen(false)}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-text-secondary hover:bg-dark-surfaceHover hover:text-premium-gold transition-colors"
                      >
                        <span>🏢</span>
                        Mi perfil B2B
                      </Link>
                      <Link
                        href="/mi-cuenta/b2b/pedidos"
                        onClick={() => setIsAccountOpen(false)}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-text-secondary hover:bg-dark-surfaceHover hover:text-premium-gold transition-colors"
                      >
                        <span>📦</span>
                        Mis pedidos B2B
                      </Link>
                      <Link
                        href="/b2b-catalog"
                        onClick={() => setIsAccountOpen(false)}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-text-secondary hover:bg-dark-surfaceHover hover:text-premium-gold transition-colors"
                      >
                        <span>🛒</span>
                        Ir al catálogo
                      </Link>

                      <hr className="my-1 border-dark-border" />

                      <button
                        onClick={async () => {
                          setIsAccountOpen(false);
                          await logoutB2B();
                          router.refresh();
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-text-secondary hover:bg-dark-surfaceHover hover:text-premium-gold transition-colors text-left"
                      >
                        <span>🚪</span>
                        Cerrar sesión B2B
                      </button>
                    </nav>
                  </div>
                )}
              </div>
            ) : session?.user ? (
              <div ref={accountWrapperRef} className="relative">
                <button
                  onClick={() => setIsAccountOpen((v) => !v)}
                  className="relative p-2 hover:bg-dark-surfaceHover rounded-lg transition-colors"
                  aria-label="Mi cuenta"
                  aria-expanded={isAccountOpen}
                >
                  <img src="/images/login.png" alt="Mi cuenta" className="w-6 h-6 icon-invert opacity-90" />
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-success border border-dark-bg rounded-full" />
                </button>

                {isAccountOpen && (
                  <div className="absolute right-0 top-full mt-2 w-56 bg-dark-surface rounded-xl shadow-elevated border border-dark-border overflow-hidden z-[9999] animate-fadeIn">
                    {/* User header */}
                    <div className="px-4 py-3 bg-dark-bgSecondary border-b border-dark-border">
                      <p className="text-xs text-text-secondary">Mi cuenta</p>
                      <p className="font-bold text-sm truncate text-text-primary">
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
                          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-text-secondary hover:bg-dark-surfaceHover hover:text-premium-gold transition-colors"
                        >
                          <span>{item.icon}</span>
                          {item.label}
                        </Link> 
                      ))}

                      <hr className="my-1 border-dark-border" />

                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-text-secondary hover:bg-dark-surfaceHover hover:text-premium-gold transition-colors text-left"
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
                className="relative p-2 hover:bg-dark-surfaceHover rounded-lg transition-colors"
                aria-label="Iniciar sesión"
              >
                <img src="/images/login.png" alt="Iniciar sesión" className="w-6 h-6 icon-invert opacity-90" />
              </button>
            )}

            {/* Shopping Bag */}
            <button
              onClick={() => setIsCartOpen(true)}
              className="relative p-2 hover:bg-dark-surfaceHover rounded-lg transition-colors"
              aria-label="Shopping cart"
            >
              <img
                src="/images/shopping-bag.png"
                alt="Shopping Cart"
                className="w-6 h-6 icon-invert opacity-90"
              />
              {totalQuantity > 0 && (
                <span className="absolute -top-1 -right-1 bg-premium-gold text-dark-bg text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
                  {totalQuantity}
                </span>
              )}
            </button>
          </div>
        </div>
      </nav>

      {/* Secondary Nav Bar: Centered menu items (desktop only) */}
      <nav className="hidden md:block bg-dark-bg/95 backdrop-blur border-b border-dark-border sticky top-16 z-40">
        <div className="container-custom px-4 py-3 flex justify-center">
          <DesktopNavMenu onOpenB2B={() => setIsB2BOpen(true)} />
        </div>
      </nav>

      {/* Dynamic Announcement Banner — always visible when banners exist */}
      <AnnouncementBannerBar />

      {/* Global Search Panel — appears below the banner, above all page content */}
      <div id="global-search-panel">
        <SearchPanel
          ref={searchPanelRef}
          open={isSearchOpen}
          onClose={() => setIsSearchOpen(false)}
        />
      </div>

      {/* Free Shipping Progress Banner — only visible when cart has items */}
      {totalQuantity > 0 && (
        <div className="bg-dark-bgSecondary border-b border-dark-border">
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

      {/* B2B Modal (login + request account) */}
      <B2BModal isOpen={isB2BOpen} onClose={() => setIsB2BOpen(false)} />
    </>
  );
}