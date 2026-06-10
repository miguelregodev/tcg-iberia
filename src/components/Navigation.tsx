'use client';

import { useState } from 'react';
import Link from 'next/link';
import { HamburgerMenu } from './HamburgerMenu';
import { useCart } from '@/context/CartContext';
import { ShoppingCartModal } from './ShoppingCartModal';

export function Navigation() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const { totalQuantity } = useCart();

  return (
    <>
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

        {/* Hamburger Menu - Slides from top */}
        {isMenuOpen && (
          <HamburgerMenu onClose={() => setIsMenuOpen(false)} />
        )}
      </nav>

      {/* Shopping Cart Modal */}
      <ShoppingCartModal isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
    </>
  );
}