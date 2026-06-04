'use client';

import Link from 'next/link';

type Language = 'ENGLISH' | 'JAPANESE' | 'KOREAN' | 'SPANISH';

interface LanguageSubmenuProps {
  category: 'booster-boxes' | 'booster-packs' | 'booster-bundles';
  onClose: () => void;
}

const LANGUAGES: { value: Language; label: string; flag: string }[] = [
  { value: 'ENGLISH', label: 'English', flag: '/images/united-kingdom.png' },
  { value: 'JAPANESE', label: 'Japanese', flag: '/images/japan.png' },
  { value: 'KOREAN', label: 'Korean', flag: '/images/south-korea.png' },
  { value: 'SPANISH', label: 'Spanish', flag: '/images/spain.png' },
];

export function LanguageSubmenu({ category, onClose }: LanguageSubmenuProps) {
  return (
    <div className="bg-gray-50 pl-8 pr-4 py-2 space-y-1 border-l-2 border-red-200">
      {LANGUAGES.map(lang => (
        <Link
          key={lang.value}
          href={`/${category}?language=${lang.value}`}
          onClick={onClose}
        >
          <div className="flex items-center gap-2 px-4 py-2.5 hover:bg-white rounded-lg transition-colors cursor-pointer group">
            <img
              src={lang.flag}
              alt={lang.label}
              className="w-5 h-3.5 rounded object-cover"
            />
            <span className="text-gray-600 group-hover:text-red-600 transition-colors">
              {lang.label}
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
}
