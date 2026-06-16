'use client';

import Link from 'next/link';

type Language = 'ENGLISH' | 'JAPANESE' | 'KOREAN' | 'SPANISH';

interface LanguageSubmenuProps {
  category: 'booster-boxes' | 'booster-packs' | 'booster-bundles' | 'etbs';
  onClose: () => void;
}

const LANGUAGES: { value: Language; label: string; flag: string }[] = [
  { value: 'ENGLISH', label: 'English', flag: '/images/united-kingdom.png' },
  { value: 'JAPANESE', label: 'Japanese', flag: '/images/japan.png' },
  { value: 'KOREAN', label: 'Korean', flag: '/images/south-korea.png' },
  { value: 'SPANISH', label: 'Spanish', flag: '/images/spain.png' },
];

const CATEGORY_LANGUAGES: Record<string, Language[]> = {
  'booster-bundles': ['ENGLISH', 'SPANISH'],
  'etbs': ['ENGLISH', 'SPANISH'],
};

export function LanguageSubmenu({ category, onClose }: LanguageSubmenuProps) {
  const allowed = CATEGORY_LANGUAGES[category];
  const languages = allowed
    ? LANGUAGES.filter((l) => allowed.includes(l.value))
    : LANGUAGES;
  return (
    <div className="ml-4 mt-1 mb-2 pl-4 pr-2 py-2 space-y-0.5 border-l-2 border-red-300/70 bg-gradient-to-r from-red-50/40 to-transparent rounded-r-lg">
      {languages.map((lang, index) => (
        <div
          key={lang.value}
          className="animate-menu-item"
          style={{ animationDelay: `${index * 60}ms` }}
        >
          <Link
            href={`/${category}?language=${lang.value}`}
            onClick={onClose}
          >
            <div className="group relative flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer overflow-hidden transition-colors">
              {/* Sliding background */}
              <span className="absolute inset-0 -translate-x-full bg-white shadow-sm transition-transform duration-300 ease-out group-hover:translate-x-0" />
              <img
                src={lang.flag}
                alt={lang.label}
                className="relative z-10 w-6 h-4 rounded object-cover shadow-sm transition-transform duration-300 ease-out group-hover:scale-110 group-hover:-rotate-3"
              />
              <span className="relative z-10 text-sm text-gray-600 font-medium tracking-wide transition-all duration-300 group-hover:text-red-600 group-hover:translate-x-0.5">
                {lang.label}
              </span>
              {/* Trailing arrow that fades in */}
              <span className="relative z-10 ml-auto opacity-0 -translate-x-2 transition-all duration-300 group-hover:opacity-100 group-hover:translate-x-0 text-red-500">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </span>
            </div>
          </Link>
        </div>
      ))}
    </div>
  );
}