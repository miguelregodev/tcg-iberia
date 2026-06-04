'use client';

import { useState } from 'react';
import { HamburgerMenu } from './HamburgerMenu';

export function Navigation() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
      <div className="container-custom px-4 py-4 flex justify-center items-center relative">
        {/* Hamburger Menu - Left */}
        <div className="absolute left-4">
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="flex flex-col gap-1.5 p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Toggle menu"
            aria-expanded={isMenuOpen}
          >
            <span className="w-6 h-0.5 bg-gray-700 rounded"></span>
            <span className="w-6 h-0.5 bg-gray-700 rounded"></span>
            <span className="w-6 h-0.5 bg-gray-700 rounded"></span>
          </button>
        </div>

        {/* Centered Logo & Brand */}
        <a href="/" className="flex items-center gap-2">
          <img src="/images/logo.png" alt="TCG Iberia" className="h-10 w-auto" />
          <span className="text-lg md:text-2xl font-bold text-red-600">TCG Iberia</span>
        </a>

        {/* Right spacer for balance */}
        <div className="absolute right-4 w-10"></div>
      </div>

      {/* Hamburger Menu - Slides from top */}
      {isMenuOpen && (
        <HamburgerMenu onClose={() => setIsMenuOpen(false)} />
      )}
    </nav>
  );
}