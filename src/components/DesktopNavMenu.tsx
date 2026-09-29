'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useB2BSession } from '@/context/B2BSessionContext';

type Category = 'booster-boxes' | 'booster-packs' | 'booster-bundles' | 'etbs';
type Language = 'ENGLISH' | 'JAPANESE' | 'KOREAN' | 'SPANISH';

interface NavItem {
  key: string;
  label: string;
  href?: string;
  category?: Category;
}

const NAV_ITEMS: NavItem[] = [
  { key: 'home', label: 'Inicio', href: '/' },
  { key: 'booster-boxes', label: 'Cajas Selladas', category: 'booster-boxes' },
  { key: 'booster-packs', label: 'Sobres', category: 'booster-packs' },
  { key: 'booster-bundles', label: 'Booster Bundles', category: 'booster-bundles' },
  { key: 'etbs', label: 'Elite Trainer Boxes', category: 'etbs' },
  { key: 'accesorios', label: 'Accesorios', href: '/accesorios' },
  { key: 'mystery-packs', label: 'Mystery Packs', href: '/mystery-packs' },
  { key: 'psa', label: 'PSA', href: '/psa' },
  { key: 'releases-calendar', label: 'Calendario de Lanzamientos', href: '/releases-calendar' },
];

const LANGUAGES: { value: Language; label: string; flag: string }[] = [
  { value: 'ENGLISH', label: 'English', flag: '/images/united-kingdom.png' },
  { value: 'JAPANESE', label: 'Japanese', flag: '/images/japan.png' },
  { value: 'KOREAN', label: 'Korean', flag: '/images/south-korea.png' },
  { value: 'SPANISH', label: 'Spanish', flag: '/images/spain.png' },
];

const CATEGORY_LANGUAGES: Record<Category, Language[]> = {
  'booster-boxes': ['JAPANESE', 'KOREAN'],
  'booster-packs': ['ENGLISH', 'JAPANESE', 'KOREAN', 'SPANISH'],
  'booster-bundles': ['ENGLISH', 'SPANISH'],
  etbs: ['ENGLISH', 'SPANISH'],
};

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`transition-transform duration-300 ease-out ${open ? 'rotate-180' : ''}`}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

interface DesktopNavMenuProps {
  /** Opens the B2B login/request modal (anonymous visitors only). */
  onOpenB2B: () => void;
}

/** Horizontal desktop navigation bar — replaces the hamburger menu at md+ breakpoints. */
export function DesktopNavMenu({ onOpenB2B }: DesktopNavMenuProps) {
  const pathname = usePathname();
  const [openKey, setOpenKey] = useState<string | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { isB2B, customer } = useB2BSession();

  useEffect(() => {
    if (!openKey) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenKey(null);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    };
  }, [openKey]);

  const handleMouseEnter = (key: string) => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    setOpenKey(key);
  };

  const handleMouseLeave = () => {
    hoverTimeoutRef.current = setTimeout(() => {
      setOpenKey(null);
    }, 200);
  };

  const linkClasses = (active: boolean) =>
    `px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
      active
        ? 'text-premium-gold bg-dark-surfaceHover'
        : 'text-text-secondary hover:text-premium-gold hover:bg-dark-surfaceHover'
    }`;

  return (
    <nav ref={wrapperRef} className="flex items-center gap-1">
      {NAV_ITEMS.map((item) => {
        if (item.href) {
          const active = pathname === item.href;
          return (
            <Link key={item.key} href={item.href} className={linkClasses(active)} aria-current={active ? 'page' : undefined}>
              {item.label}
            </Link>
          );
        }

        const isOpen = openKey === item.key;
        const active = !!item.category && pathname === `/${item.category}`;
        const languages = item.category ? LANGUAGES.filter((l) => CATEGORY_LANGUAGES[item.category!].includes(l.value)) : [];

        return (
          <div
            key={item.key}
            className="relative group"
            onMouseEnter={() => handleMouseEnter(item.key)}
            onMouseLeave={handleMouseLeave}
          >
            <button
              type="button"
              aria-expanded={isOpen}
              aria-haspopup="true"
              className={`flex items-center gap-1 ${linkClasses(active || isOpen)}`}
            >
              {item.label}
              <ChevronIcon open={isOpen} />
            </button>

            {isOpen && item.category && (
              <div className="absolute left-0 top-full mt-0 w-56 bg-dark-surface border border-dark-border rounded-xl shadow-elevated overflow-hidden z-[9999] animate-fadeIn p-1">
                <Link
                  href={`/${item.category}`}
                  className="block px-3 py-2.5 rounded-lg text-sm font-medium text-text-secondary hover:text-premium-gold hover:bg-dark-surfaceHover transition-colors"
                >
                  Ver todo
                </Link>
                {languages.map((lang) => (
                  <Link
                    key={lang.value}
                    href={`/${item.category}?language=${lang.value}`}
                    className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-text-secondary hover:text-premium-gold hover:bg-dark-surfaceHover transition-colors"
                  >
                    <img src={lang.flag} alt="" className="w-5 h-3.5 object-cover rounded-sm" />
                    {lang.label}
                  </Link>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* B2B — either opens the login/request modal, or links to the wholesale catalog when already logged in */}
      {isB2B ? (
        <Link href="/b2b-catalog" className={`flex items-center gap-2 ${linkClasses(pathname === '/b2b-catalog')}`}>
          B2B
          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wide bg-premium-gold/15 text-premium-gold">
            {customer?.companyName ?? 'Mayorista'}
          </span>
        </Link>
      ) : (
        <button type="button" onClick={onOpenB2B} className={linkClasses(false)}>
          B2B
        </button>
      )}
    </nav>
  );
}
