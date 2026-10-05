'use client';

import { useState } from 'react';
import Link from 'next/link';
import { LanguageSubmenu } from './LanguageSubmenu';
import { useB2BSession } from '@/context/B2BSessionContext';

interface HamburgerMenuProps {
  onClose: () => void;
  /** Trigger opening the B2B modal. Provided by Navigation. */
  onOpenB2B?: () => void;
}

type Category = 'booster-boxes' | 'booster-packs' | 'booster-bundles' | 'etbs';

interface MenuChild {
  key: string;
  label: string;
  href: string;
}

interface MenuItem {
  key: string;
  label: string;
  href?: string;
  category?: Category;
  /** Static submenu of plain links (no language filtering), e.g. Singles -> PSA / Raw. */
  children?: MenuChild[];
  /** Custom action instead of navigation (e.g. open a modal). */
  action?: 'b2b';
}

const MENU_ITEMS: MenuItem[] = [
  { key: 'home', label: 'Inicio', href: '/' },
  { key: 'booster-boxes', label: 'Cajas Selladas', category: 'booster-boxes' },
  { key: 'booster-packs', label: 'Sobres', category: 'booster-packs' },
  { key: 'booster-bundles', label: 'Booster Bundles', category: 'booster-bundles' },
  { key: 'etbs', label: 'Elite Trainer Boxes', category: 'etbs' },
  { key: 'accesorios', label: 'Accesorios', href: '/accesorios' },
  { key: 'mystery-packs', label: 'Mystery Packs', href: '/mystery-packs' },
  {
    key: 'singles',
    label: 'Singles',
    children: [
      { key: 'psa', label: 'PSA', href: '/psa' },
      { key: 'raw', label: 'Raw', href: '/raw' },
    ],
  },
  { key: 'releases-calendar', label: 'Calendario de Lanzamientos', href: '/releases-calendar' },
  { key: 'b2b', label: 'B2B', action: 'b2b' },
];

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`transition-transform duration-300 ease-out ${open ? 'rotate-180 text-premium-gold' : 'text-text-muted group-hover:text-premium-gold'}`}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

export function HamburgerMenu({ onClose, onOpenB2B }: HamburgerMenuProps) {
  const [expandedMenu, setExpandedMenu] = useState<string | null>(null);
  const { isB2B, customer } = useB2BSession();

  const toggleSubmenu = (menu: string) => {
    setExpandedMenu(expandedMenu === menu ? null : menu);
  };

  return (
    <div className="relative bg-dark-surface/95 backdrop-blur-md border border-dark-border rounded-xl shadow-elevated overflow-hidden animate-menu-slide">
      {/* Top accent gradient line */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-premium-gold to-transparent" />

      <div className="px-2 py-3 space-y-1">
        {MENU_ITEMS.map((item, index) => {
          const isExpanded = expandedMenu === item.key;
          const animationStyle = { animationDelay: `${60 + index * 50}ms` };

          // Action items — either open the B2B modal (anonymous) or, when
          // already logged in as B2B, act as a shortcut to the wholesale
          // catalog. The dedicated top-bar dropdown handles profile / orders
          // / logout, so we keep this item lean.
          if (item.action === 'b2b') {
            if (isB2B) {
              return (
                <div key={item.key} className="animate-menu-item" style={animationStyle}>
                  <Link
                    href="/b2b-catalog"
                    onClick={onClose}
                    className="group relative w-full text-left flex items-center px-4 py-3 rounded-lg font-medium text-text-secondary overflow-hidden transition-colors hover:text-premium-gold"
                  >
                    <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-dark-surfaceHover via-dark-surfaceHover to-transparent transition-transform duration-300 ease-out group-hover:translate-x-0" />
                    <span className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full bg-premium-gold scale-y-0 origin-center transition-transform duration-300 ease-out group-hover:scale-y-100" />
                    <span className="relative z-10 flex items-center gap-2 transition-transform duration-300 group-hover:translate-x-1">
                      {item.label}
                      <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wide bg-premium-gold/15 text-premium-gold">
                        {customer?.companyName ?? 'Mayorista'}
                      </span>
                    </span>
                  </Link>
                </div>
              );
            }

            return (
              <div key={item.key} className="animate-menu-item" style={animationStyle}>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenB2B?.();
                  }}
                  className="group relative w-full text-left flex items-center px-4 py-3 rounded-lg font-medium text-text-secondary overflow-hidden transition-colors hover:text-premium-gold"
                >
                  <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-dark-surfaceHover via-dark-surfaceHover to-transparent transition-transform duration-300 ease-out group-hover:translate-x-0" />
                  <span className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full bg-premium-gold scale-y-0 origin-center transition-transform duration-300 ease-out group-hover:scale-y-100" />
                  <span className="relative z-10 flex items-center gap-2 transition-transform duration-300 group-hover:translate-x-1">
                    {item.label}
                    <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wide bg-premium-gold/15 text-premium-gold">
                      Mayorista
                    </span>
                  </span>
                </button>
              </div>
            );
          }

          if (item.href) {
            return (
              <div
                key={item.key}
                className="animate-menu-item"
                style={animationStyle}
              >
                <Link href={item.href} onClick={onClose}>
                  <div className="group relative flex items-center px-4 py-3 rounded-lg text-text-secondary font-medium cursor-pointer overflow-hidden transition-colors hover:text-premium-gold">
                    {/* Sliding background */}
                    <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-dark-surfaceHover via-dark-surfaceHover to-transparent transition-transform duration-300 ease-out group-hover:translate-x-0" />
                    {/* Left accent bar */}
                    <span className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full bg-premium-gold scale-y-0 origin-center transition-transform duration-300 ease-out group-hover:scale-y-100" />
                    <span className="relative z-10 transition-transform duration-300 group-hover:translate-x-1">
                      {item.label}
                    </span>
                  </div>
                </Link>
              </div>
            );
          }

          return (
            <div
              key={item.key}
              className="animate-menu-item"
              style={animationStyle}
            >
              <button
                onClick={() => toggleSubmenu(item.key)}
                aria-expanded={isExpanded}
                className={`group relative w-full text-left flex justify-between items-center px-4 py-3 rounded-lg font-medium overflow-hidden transition-colors ${
                  isExpanded ? 'text-premium-gold bg-dark-surfaceHover' : 'text-text-secondary hover:text-premium-gold'
                }`}
              >
                {/* Sliding background on hover */}
                <span
                  className={`absolute inset-0 bg-gradient-to-r from-dark-surfaceHover via-dark-surfaceHover to-transparent transition-transform duration-300 ease-out ${
                    isExpanded ? 'translate-x-0' : '-translate-x-full group-hover:translate-x-0'
                  }`}
                />
                {/* Left accent bar */}
                <span
                  className={`absolute left-0 top-2 bottom-2 w-0.5 rounded-full bg-premium-gold origin-center transition-transform duration-300 ease-out ${
                    isExpanded ? 'scale-y-100' : 'scale-y-0 group-hover:scale-y-100'
                  }`}
                />
                <span className={`relative z-10 transition-transform duration-300 ${isExpanded ? 'translate-x-1' : 'group-hover:translate-x-1'}`}>
                  {item.label}
                </span>
                <span className="relative z-10">
                  <ChevronIcon open={isExpanded} />
                </span>
              </button>

              {isExpanded && item.category && (
                <div className="animate-accordion">
                  <LanguageSubmenu category={item.category} onClose={onClose} />
                </div>
              )}

              {isExpanded && item.children && (
                <div className="animate-accordion ml-4 mt-1 mb-2 pl-4 pr-2 py-2 space-y-0.5 border-l-2 border-premium-gold/40 bg-gradient-to-r from-dark-surfaceHover/60 to-transparent rounded-r-lg">
                  {item.children.map((child, index) => (
                    <div
                      key={child.key}
                      className="animate-menu-item"
                      style={{ animationDelay: `${index * 60}ms` }}
                    >
                      <Link href={child.href} onClick={onClose}>
                        <div className="group relative flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer overflow-hidden transition-colors">
                          <span className="absolute inset-0 -translate-x-full bg-dark-surfaceHover shadow-sm transition-transform duration-300 ease-out group-hover:translate-x-0" />
                          <span className="relative z-10 text-sm text-text-secondary font-medium tracking-wide transition-all duration-300 group-hover:text-premium-gold group-hover:translate-x-0.5">
                            {child.label}
                          </span>
                        </div>
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}