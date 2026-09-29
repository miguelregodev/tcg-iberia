'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import * as Sentry from '@sentry/nextjs';
import { trackFavoriteRemoved } from '@/lib/analytics/events';
import { useCart } from '@/context/CartContext';
import type { Product } from '@/types';

interface FavoriteProduct {
  id: string;
  name: string;
  slug: string;
  price: number;
  discountPercentage: number | null;
  imageUrl: string | null;
  stock: number;
  type: string | null;
  visible: boolean;
  weightGrams: number | null;
  lengthCm: number | null;
  widthCm: number | null;
  heightCm: number | null;
}

interface Favorite {
  id: string;
  product: FavoriteProduct;
}

function StockBadge({ stock }: { stock: number }) {
  if (stock === 0) {
    return (
      <span className="inline-block px-2 py-0.5 rounded-full bg-dark-surfaceHover text-text-secondary text-xs font-medium">
        Agotado
      </span>
    );
  }
  if (stock <= 5) {
    return (
      <span className="inline-block px-2 py-0.5 rounded-full bg-warning-bg text-warning text-xs font-medium">
        Últimas unidades
      </span>
    );
  }
  return (
    <span className="inline-block px-2 py-0.5 rounded-full bg-success-bg text-success text-xs font-medium">
      Disponible
    </span>
  );
}

export default function FavoritosPage() {
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [addedToCart, setAddedToCart] = useState<string | null>(null);
  const { addToCart } = useCart();

  const handleAddToCart = (product: FavoriteProduct) => {
    const cartProduct: Product = {
      id: product.id,
      name: product.name,
      slug: product.slug,
      description: '',
      price: Number(product.price),
      discountPercentage: product.discountPercentage ? Number(product.discountPercentage) : null,
      notes: null,
      type: product.type,
      releaseDate: null,
      stock: product.stock,
      imageUrl: product.imageUrl,
      language: 'SPANISH',
      priority: 0,
      visible: product.visible,
      available: product.stock > 0,
      canPurchase: product.stock > 0,
      isPreorder: false,
      inventoryStatus: product.stock === 0 ? 'out_of_stock' : product.stock <= 5 ? 'low_stock' : 'available',
      liveOpeningPrice: null,
      b2bPrice: null,
      weightGrams: product.weightGrams,
      lengthCm: product.lengthCm,
      widthCm: product.widthCm,
      heightCm: product.heightCm,
      createdAt: '',
      updatedAt: '',
    };
    addToCart(cartProduct, 1);
    setAddedToCart(product.id);
    setTimeout(() => setAddedToCart(null), 1500);
  };

  useEffect(() => {
    const fetchFavorites = async () => {
      try {
        const res = await fetch('/api/user/favorites');
        if (!res.ok) throw new Error('Failed to load favorites');
        const json = await res.json();
        setFavorites(json.data ?? []);
      } catch (err) {
        Sentry.captureException(err, { tags: { module: 'mi-cuenta', section: 'favoritos' } });
        setError('No se pudieron cargar tus favoritos.');
      } finally {
        setLoading(false);
      }
    };

    fetchFavorites();
  }, []);

  const handleRemoveFavorite = async (product: FavoriteProduct) => {
    setRemoving(product.id);
    try {
      const res = await fetch(`/api/user/favorites?productId=${encodeURIComponent(product.id)}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to remove favorite');
      setFavorites((prev) => prev.filter((fav) => fav.product.id !== product.id));
      trackFavoriteRemoved({
        productId: product.id,
        productName: product.name,
        category: product.type ?? undefined,
        price: Number(product.price),
      });
    } catch (err) {
      Sentry.captureException(err, { tags: { module: 'mi-cuenta', action: 'remove_favorite' } });
    } finally {
      setRemoving(null);
    }
  };

  if (loading) {
    return (
      <div className="card">
        <div className="animate-pulse space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-28 bg-dark-surfaceHover rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <h1 className="text-h3 mb-6">Mis Favoritos</h1>

      {error && (
        <div className="mb-5 px-4 py-3 bg-danger-bg border border-danger/30 text-danger rounded-lg text-sm">
          {error}
        </div>
      )}

      {favorites.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-6xl mb-5 select-none" aria-hidden="true">
            <svg viewBox="0 0 24 24" className="w-16 h-16 mx-auto text-text-muted" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" />
            </svg>
          </div>
          <p className="text-lg font-semibold text-text-primary mb-2">No tienes productos favoritos todavía.</p>
          <p className="text-sm text-text-secondary mb-6">Guarda los productos que te gusten para encontrarlos fácilmente.</p>
          <Link
            href="/booster-boxes"
            className="btn btn-primary inline-flex items-center gap-2"
          >
            Explorar productos
          </Link>
        </div>
      ) : (
        <>
          <p className="text-sm text-text-secondary mb-5">
            {favorites.length} {favorites.length === 1 ? 'producto guardado' : 'productos guardados'}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {favorites.map((fav) => {
              const product = fav.product;
              const finalPrice = product.discountPercentage
                ? Number(product.price) * (1 - Number(product.discountPercentage) / 100)
                : Number(product.price);

              return (
                <div
                  key={fav.id}
                  className="group border border-dark-border rounded-xl overflow-hidden hover:border-premium-gold/30 hover:shadow-elevated transition-all"
                >
                  {/* Product image — clickable */}
                  <Link href={`/product/${product.slug}`} className="block">
                    <div className="relative bg-dark-bgSecondary h-40 overflow-hidden">
                      {product.imageUrl ? (
                        <img
                          src={product.imageUrl}
                          alt={product.name}
                          className="w-full h-full object-contain p-4 group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-text-muted">
                          <svg viewBox="0 0 24 24" className="w-12 h-12" fill="none" stroke="currentColor" strokeWidth={1}>
                            <rect width="18" height="18" x="3" y="3" rx="2" />
                            <path d="m3 15 5-5 4 4 3-3 5 5" />
                          </svg>
                        </div>
                      )}
                      {product.discountPercentage && (
                        <div className="absolute top-2 right-2 bg-premium-gold text-dark-bg text-xs font-bold px-2 py-0.5 rounded-full">
                          -{Number(product.discountPercentage)}%
                        </div>
                      )}
                    </div>
                  </Link>

                  {/* Product info */}
                  <div className="p-4">
                    <Link href={`/product/${product.slug}`} className="block mb-2">
                      <p className="font-semibold text-text-primary leading-snug group-hover:text-premium-gold transition-colors line-clamp-2">
                        {product.name}
                      </p>
                    </Link>

                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div>
                        <span className="text-premium-gold font-bold text-lg">
                          {finalPrice.toFixed(2)} €
                        </span>
                        {product.discountPercentage && (
                          <span className="ml-2 text-xs text-text-muted line-through">
                            {Number(product.price).toFixed(2)} €
                          </span>
                        )}
                      </div>
                      <StockBadge stock={product.stock} />
                    </div>

                    <div className="flex items-center gap-2">
                      <Link
                        href={`/product/${product.slug}`}
                        className="flex-1 text-center btn btn-primary text-sm py-2"
                      >
                        Ver producto
                      </Link>
                      <button
                        onClick={() => handleAddToCart(product)}
                        disabled={product.stock === 0}
                        aria-label={`Añadir ${product.name} al carrito`}
                        title={product.stock === 0 ? 'Agotado' : 'Añadir al carrito'}
                        className="p-2 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-text-muted hover:text-premium-gold hover:bg-dark-surfaceHover"
                      >
                        {addedToCart === product.id ? (
                          <svg viewBox="0 0 24 24" className="w-5 h-5 text-success" fill="none" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                          </svg>
                        ) : (
                          <img src="/images/add-to-cart.png" alt="Añadir al carrito" className="w-5 h-5 icon-invert opacity-70" />
                        )}
                      </button>
                      <button
                        onClick={() => handleRemoveFavorite(product)}
                        disabled={removing === product.id}
                        aria-label={`Eliminar ${product.name} de favoritos`}
                        className="p-2 text-text-muted hover:opacity-75 rounded-lg transition-opacity disabled:opacity-40"
                      >
                        <img
                          src="/images/favorite.png"
                          alt="Eliminar de favoritos"
                          className="w-5 h-5 icon-invert opacity-70"
                        />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
