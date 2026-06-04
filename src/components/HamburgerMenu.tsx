'use client';

import { useState } from 'react';
import Link from 'next/link';
import { LanguageSubmenu } from './LanguageSubmenu';

interface HamburgerMenuProps {
  onClose: () => void;
}

export function HamburgerMenu({ onClose }: HamburgerMenuProps) {
  const [expandedMenu, setExpandedMenu] = useState<string | null>(null);

  const toggleSubmenu = (menu: string) => {
    setExpandedMenu(expandedMenu === menu ? null : menu);
  };

  return (
    <div className="bg-white border-b border-gray-200 overflow-hidden animate-slideUp">
      <div className="container-custom px-4 py-2 space-y-2">
        {/* Home */}
        <Link href="/" onClick={onClose}>
          <div className="px-4 py-3 hover:bg-gray-50 rounded-lg text-gray-700 hover:text-red-600 font-medium transition-colors cursor-pointer">
            Home
          </div>
        </Link>

        {/* Booster Boxes */}
        <div>
          <button
            onClick={() => toggleSubmenu('booster-boxes')}
            className="w-full text-left px-4 py-3 hover:bg-gray-50 rounded-lg text-gray-700 hover:text-red-600 font-medium transition-colors flex justify-between items-center"
          >
            Booster Boxes
            <span className={`text-gray-400 transition-transform ${expandedMenu === 'booster-boxes' ? 'rotate-180' : ''}`}>
              ▼
            </span>
          </button>
          {expandedMenu === 'booster-boxes' && (
            <LanguageSubmenu category="booster-boxes" onClose={onClose} />
          )}
        </div>

        {/* Booster Packs */}
        <div>
          <button
            onClick={() => toggleSubmenu('booster-packs')}
            className="w-full text-left px-4 py-3 hover:bg-gray-50 rounded-lg text-gray-700 hover:text-red-600 font-medium transition-colors flex justify-between items-center"
          >
            Booster Packs
            <span className={`text-gray-400 transition-transform ${expandedMenu === 'booster-packs' ? 'rotate-180' : ''}`}>
              ▼
            </span>
          </button>
          {expandedMenu === 'booster-packs' && (
            <LanguageSubmenu category="booster-packs" onClose={onClose} />
          )}
        </div>

        {/* Booster Bundles */}
        <div>
          <button
            onClick={() => toggleSubmenu('booster-bundles')}
            className="w-full text-left px-4 py-3 hover:bg-gray-50 rounded-lg text-gray-700 hover:text-red-600 font-medium transition-colors flex justify-between items-center"
          >
            Booster Bundles
            <span className={`text-gray-400 transition-transform ${expandedMenu === 'booster-bundles' ? 'rotate-180' : ''}`}>
              ▼
            </span>
          </button>
          {expandedMenu === 'booster-bundles' && (
            <LanguageSubmenu category="booster-bundles" onClose={onClose} />
          )}
        </div>
      </div>
    </div>
  );
}
