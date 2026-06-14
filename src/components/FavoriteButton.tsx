'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import * as Sentry from '@sentry/nextjs';
import { LoginModal } from './LoginModal';
import { trackFavoriteAdded, trackFavoriteRemoved } from '@/lib/analytics/events';

interface FavoriteButtonProps {
  productId: string;
  productName: string;
  productCategory?: string;
  productPrice?: number;
  /** Extra classes applied to the outer wrapper */
  className?: string;
}

export function FavoriteButton({
  productId,
  productName,
  productCategory,
  productPrice,
  className = '',
}: FavoriteButtonProps) {
  const { data: session, status } = useSession();
  const [isFavorited, setIsFavorited] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [burst, setBurst] = useState(false);

  const triggerBurst = () => {
    setBurst(true);
    setTimeout(() => setBurst(false), 600);
  };

  const showToast = useCallback((message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 2500);
  }, []);

  // Load favorite status once the session is known
  useEffect(() => {
    if (status === 'loading') return;
    if (!session?.user) {
      setLoading(false);
      return;
    }

    const load = async () => {
      try {
        const res = await fetch(`/api/user/favorites?productId=${encodeURIComponent(productId)}`);
        if (!res.ok) throw new Error('Failed to load favorite status');
        const json = await res.json();
        setIsFavorited(json.isFavorited ?? false);
      } catch (err) {
        Sentry.captureException(err, {
          tags: { module: 'FavoriteButton', productId },
        });
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [session, status, productId]);

  const handleToggle = async () => {
    // Not authenticated — prompt login
    if (!session?.user) {
      setIsLoginOpen(true);
      return;
    }

    // Optimistic update
    const wasAlreadyFavorited = isFavorited;
    setIsFavorited(!wasAlreadyFavorited);
    triggerBurst();

    const analyticsPayload = {
      productId,
      productName,
      category: productCategory,
      price: productPrice,
    };

    try {
      if (wasAlreadyFavorited) {
        const res = await fetch(`/api/user/favorites?productId=${encodeURIComponent(productId)}`, {
          method: 'DELETE',
        });
        if (!res.ok) throw new Error('Failed to remove favorite');
        trackFavoriteRemoved(analyticsPayload);
        showToast('Eliminado de favoritos');
      } else {
        const res = await fetch('/api/user/favorites', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ productId }),
        });
        if (!res.ok) throw new Error('Failed to add favorite');
        trackFavoriteAdded(analyticsPayload);
        showToast('Añadido a favoritos ❤️');
      }
    } catch (err) {
      // Revert optimistic update on error
      setIsFavorited(wasAlreadyFavorited);
      showToast('Ha ocurrido un error. Inténtalo de nuevo.');
      Sentry.captureException(err, {
        tags: { module: 'FavoriteButton', action: wasAlreadyFavorited ? 'remove' : 'add', productId },
      });
    }
  };

  return (
    <>
      <div className={`relative ${className}`}>
        <button
          type="button"
          onClick={handleToggle}
          disabled={loading}
          aria-label={isFavorited ? 'Eliminar de favoritos' : 'Añadir a favoritos'}
          aria-pressed={isFavorited}
          title={
            !session?.user
              ? 'Inicia sesión para guardar favoritos'
              : isFavorited
              ? 'Eliminar de favoritos'
              : 'Añadir a favoritos'
          }
          className={`
            relative flex items-center justify-center
            w-full h-full rounded-xl border-2
            transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500
            disabled:opacity-50 disabled:cursor-not-allowed
            ${
              isFavorited
                ? 'border-red-400 bg-red-50 hover:bg-red-100'
                : 'border-gray-300 bg-white hover:border-red-400 hover:bg-red-50'
            }
          `}
        >
          {/* Burst ring animation on click */}
          {burst && (
            <span
              aria-hidden="true"
              className="absolute inset-0 rounded-xl border-2 border-red-400 animate-ping opacity-60 pointer-events-none"
            />
          )}

          {/* Particle dots — appear on add */}
          {burst && isFavorited && (
            <span aria-hidden="true" className="absolute inset-0 pointer-events-none">
              {[...Array(6)].map((_, i) => (
                <span
                  key={i}
                  className="absolute w-1.5 h-1.5 rounded-full bg-red-400"
                  style={{
                    top: '50%',
                    left: '50%',
                    transform: `translate(-50%, -50%) rotate(${i * 60}deg) translateY(-18px)`,
                    opacity: 0,
                    animation: 'favoriteParticle 0.5s ease-out forwards',
                    animationDelay: `${i * 30}ms`,
                  }}
                />
              ))}
            </span>
          )}

          <img
            src={isFavorited ? '/images/favorite.png' : '/images/no-favorite.png'}
            alt=""
            aria-hidden="true"
            className={`w-6 h-6 transition-transform duration-300 ${
              burst && isFavorited ? 'scale-125' : isFavorited ? 'scale-110' : 'scale-100'
            }`}
          />
        </button>

        {/* Toast notification */}
        {toast && (
          <div
            role="status"
            aria-live="polite"
            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 whitespace-nowrap px-3 py-2 bg-gray-900 text-white text-xs rounded-lg shadow-lg z-10 animate-fadeIn"
          >
            {toast}
          </div>
        )}
      </div>

      {/* Login modal — shown when unauthenticated user tries to favorite */}
      <LoginModal isOpen={isLoginOpen} onClose={() => setIsLoginOpen(false)} />
    </>
  );
}
