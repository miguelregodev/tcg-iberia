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

interface MenuItem {
  key: string;
  label: string;
  href?: string;
  category?: Category;
  /** Custom action instead of navigation (e.g. open a modal). */
  action?: 'b2b';
}

const MENU_ITEMS: MenuItem[] = [
  { key: 'home', label: 'Inicio', href: '/' },
  { key: 'booster-boxes', label: 'Cajas Selladas', category: 'booster-boxes' },
  { key: 'booster-packs', label: 'Sobres', category: 'booster-packs' },
  { key: 'booster-bundles', label: 'Booster Bundles', category: 'booster-bundles' },
  { key: 'etbs', label: 'Elite Trainer Boxes', category: 'etbs' },
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
      className={`transition-transform duration-300 ease-out ${open ? 'rotate-180 text-red-600' : 'text-gray-400 group-hover:text-red-500'}`}
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
    <div className="relative bg-white/95 backdrop-blur-md border border-gray-200 rounded-xl shadow-2xl overflow-hidden animate-menu-slide">
      {/* Top accent gradient line */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-red-500 to-transparent" />

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
                    className="group relative w-full text-left flex items-center px-4 py-3 rounded-lg font-medium text-gray-700 overflow-hidden transition-colors hover:text-red-600"
                  >
                    <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-red-50 via-red-50 to-transparent transition-transform duration-300 ease-out group-hover:translate-x-0" />
                    <span className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full bg-red-500 scale-y-0 origin-center transition-transform duration-300 ease-out group-hover:scale-y-100" />
                    <span className="relative z-10 flex items-center gap-2 transition-transform duration-300 group-hover:translate-x-1">
                      {item.label}
                      <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wide bg-red-100 text-red-700">
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
                  className="group relative w-full text-left flex items-center px-4 py-3 rounded-lg font-medium text-gray-700 overflow-hidden transition-colors hover:text-red-600"
                >
                  <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-red-50 via-red-50 to-transparent transition-transform duration-300 ease-out group-hover:translate-x-0" />
                  <span className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full bg-red-500 scale-y-0 origin-center transition-transform duration-300 ease-out group-hover:scale-y-100" />
                  <span className="relative z-10 flex items-center gap-2 transition-transform duration-300 group-hover:translate-x-1">
                    {item.label}
                    <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wide bg-red-100 text-red-700">
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
                  <div className="group relative flex items-center px-4 py-3 rounded-lg text-gray-700 font-medium cursor-pointer overflow-hidden transition-colors hover:text-red-600">
                    {/* Sliding background */}
                    <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-red-50 via-red-50 to-transparent transition-transform duration-300 ease-out group-hover:translate-x-0" />
                    {/* Left accent bar */}
                    <span className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full bg-red-500 scale-y-0 origin-center transition-transform duration-300 ease-out group-hover:scale-y-100" />
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
                  isExpanded ? 'text-red-600 bg-red-50/60' : 'text-gray-700 hover:text-red-600'
                }`}
              >
                {/* Sliding background on hover */}
                <span
                  className={`absolute inset-0 bg-gradient-to-r from-red-50 via-red-50 to-transparent transition-transform duration-300 ease-out ${
                    isExpanded ? 'translate-x-0' : '-translate-x-full group-hover:translate-x-0'
                  }`}
                />
                {/* Left accent bar */}
                <span
                  className={`absolute left-0 top-2 bottom-2 w-0.5 rounded-full bg-red-500 origin-center transition-transform duration-300 ease-out ${
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
            </div>
          );
        })}
      </div>
    </div>
  );
}