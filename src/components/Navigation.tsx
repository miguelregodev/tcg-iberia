'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { HamburgerMenu } from './HamburgerMenu';
import { useCart } from '@/context/CartContext';
import { ShoppingCartModal } from './ShoppingCartModal';

export function Navigation() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const { totalQuantity } = useCart();
  const menuWrapperRef = useRef<HTMLDivElement>(null);

  // Close on outside click and on Escape.
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

          {/* Shopping Bag - Right */}
          <div className="absolute right-4">
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

      {/* Shopping Cart Modal */}
      <ShoppingCartModal isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
    </>
  );
}