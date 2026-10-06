'use client';

import { useEffect, useState, useMemo } from 'react';
import type { Product } from '@/types';
import { AdminNav } from '@/components/AdminNav';
import { ProductForm } from '@/components/ProductForm';

const PAGE_SIZE_OPTIONS = [5, 10, 25, 50, 100];

const LANGUAGE_LABELS: Record<string, string> = {
  ENGLISH: 'Inglés',
  JAPANESE: 'Japonés',
  KOREAN: 'Coreano',
  SPANISH: 'Español',
};

const LANGUAGE_FLAGS: Record<string, string> = {
  ENGLISH: '/images/united-kingdom.png',
  JAPANESE: '/images/japan.png',
  KOREAN: '/images/south-korea.png',
  SPANISH: '/images/spain.png',
};

const currency = new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR',
});

export default function AdminProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [duplicatingProduct, setDuplicatingProduct] = useState<Product | null>(null);

  const [search, setSearch] = useState('');
  const [languageFilter, setLanguageFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [visibilityFilter, setVisibilityFilter] = useState<'' | 'visible' | 'hidden'>('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/products');
      if (response.ok) {
        const data = await response.json();
        setProducts(data);
      }
    } catch (err) {
      console.error('Failed to fetch products');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este producto?')) return;
    try {
      await fetch(`/api/admin/products/${id}`, { method: 'DELETE' });
      setProducts((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      console.error('Failed to delete product');
    }
  };

  const productTypes = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.type) set.add(p.type);
    });
    return Array.from(set).sort();
  }, [products]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return products.filter((p) => {
      if (term) {
        const inName = p.name.toLowerCase().includes(term);
        const inSlug = p.slug?.toLowerCase().includes(term) ?? false;
        const inType = p.type?.toLowerCase().includes(term) ?? false;
        if (!inName && !inSlug && !inType) return false;
      }
      if (languageFilter && p.language !== languageFilter) return false;
      if (typeFilter && p.type !== typeFilter) return false;
      if (visibilityFilter === 'visible' && !p.visible) return false;
      if (visibilityFilter === 'hidden' && p.visible) return false;
      return true;
    });
  }, [products, search, languageFilter, typeFilter, visibilityFilter]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const skip = (safePage - 1) * pageSize;
  const pageItems = filtered.slice(skip, skip + pageSize);

  const rangeStart = total === 0 ? 0 : skip + 1;
  const rangeEnd = Math.min(skip + pageSize, total);

  const handleNew = () => {
    setEditingProduct(null);
    setShowForm(true);
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setDuplicatingProduct(null);
    setShowForm(true);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleDuplicate = (product: Product) => {
    setDuplicatingProduct(product);
    setEditingProduct(null);
    setShowForm(true);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleFormSuccess = () => {
    setShowForm(false);
    setEditingProduct(null);
    setDuplicatingProduct(null);
    fetchProducts();
  };

  const resetFilters = () => {
    setSearch('');
    setLanguageFilter('');
    setTypeFilter('');
    setVisibilityFilter('');
    setPage(1);
  };

  return (
    <>
      <AdminNav />
      <div className="min-h-screen bg-dark-bg">
        <div className="container-custom section">
          <div className="flex flex-wrap justify-between items-center mb-6 gap-4">
            <div>
              <h1 className="text-h2">Productos</h1>
              <p className="text-sm text-text-muted mt-1">
                {total === 0
                  ? 'Sin productos'
                  : `Mostrando ${rangeStart}-${rangeEnd} de ${total}`}
              </p>
            </div>

            <div className="flex items-center gap-3">
              {showForm ? (
                <button
                  onClick={() => {
                    setShowForm(false);
                    setEditingProduct(null);
                    setDuplicatingProduct(null);
                  }}
                  className="btn btn-secondary"
                >
                  Cerrar formulario
                </button>
              ) : (
                <button onClick={handleNew} className="btn btn-primary">
                  + Añadir producto
                </button>
              )}
            </div>
          </div>

          {showForm && (
            <div className="mb-8">
              <ProductForm
                product={editingProduct || undefined}
                initialData={duplicatingProduct || undefined}
                isDuplicate={!!duplicatingProduct}
                onSuccess={handleFormSuccess}
              />
            </div>
          )}

          {/* Filters */}
          <div className="bg-dark-surface rounded-xl shadow-sm border border-dark-border p-4 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
              <div className="lg:col-span-2">
                <label className="block text-xs font-semibold text-text-muted uppercase tracking-wide mb-1">
                  Buscar
                </label>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Nombre, slug, tipo..."
                  className="w-full border border-dark-border rounded-lg px-3 py-2 text-sm bg-dark-surface text-text-primary focus:outline-none focus:ring-2 focus:ring-premium-gold"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-muted uppercase tracking-wide mb-1">
                  Idioma
                </label>
                <select
                  value={languageFilter}
                  onChange={(e) => {
                    setLanguageFilter(e.target.value);
                    setPage(1);
                  }}
                  className="w-full border border-dark-border rounded-lg px-3 py-2 text-sm bg-dark-surface text-text-primary focus:outline-none focus:ring-2 focus:ring-premium-gold"
                >
                  <option value="">Todos</option>
                  <option value="ENGLISH">Inglés</option>
                  <option value="JAPANESE">Japonés</option>
                  <option value="KOREAN">Coreano</option>
                  <option value="SPANISH">Español</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-muted uppercase tracking-wide mb-1">
                  Tipo
                </label>
                <select
                  value={typeFilter}
                  onChange={(e) => {
                    setTypeFilter(e.target.value);
                    setPage(1);
                  }}
                  className="w-full border border-dark-border rounded-lg px-3 py-2 text-sm bg-dark-surface text-text-primary focus:outline-none focus:ring-2 focus:ring-premium-gold"
                >
                  <option value="">Todos</option>
                  {productTypes.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-muted uppercase tracking-wide mb-1">
                  Visibilidad
                </label>
                <select
                  value={visibilityFilter}
                  onChange={(e) => {
                    setVisibilityFilter(
                      e.target.value as '' | 'visible' | 'hidden',
                    );
                    setPage(1);
                  }}
                  className="w-full border border-dark-border rounded-lg px-3 py-2 text-sm bg-dark-surface text-text-primary focus:outline-none focus:ring-2 focus:ring-premium-gold"
                >
                  <option value="">Todos</option>
                  <option value="visible">Visibles</option>
                  <option value="hidden">Ocultos</option>
                </select>
              </div>
            </div>
            {(search || languageFilter || typeFilter || visibilityFilter) && (
              <div className="mt-3 flex justify-end">
                <button
                  onClick={resetFilters}
                  className="text-xs text-premium-gold hover:text-premium-gold_dark font-medium"
                >
                  Limpiar filtros
                </button>
              </div>
            )}
          </div>

          {/* Per-page selector */}
          <div className="flex justify-end mb-3 text-sm">
            <div className="flex items-center gap-2">
              <label htmlFor="pageSize" className="text-text-secondary font-medium">
                Productos por página:
              </label>
              <select
                id="pageSize"
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                className="border border-dark-border rounded-lg px-3 py-2 bg-dark-surface text-text-primary focus:outline-none focus:ring-2 focus:ring-premium-gold"
              >
                {PAGE_SIZE_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="bg-dark-surface rounded-xl shadow-sm border border-dark-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-dark-bgSecondary text-text-muted uppercase text-xs tracking-wide">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold w-16">
                      Imagen
                    </th>
                    <th className="px-4 py-3 text-left font-semibold">
                      Nombre
                    </th>
                    <th className="px-4 py-3 text-left font-semibold">Tipo</th>
                    <th className="px-4 py-3 text-center font-semibold">
                      Idioma
                    </th>
                    <th className="px-4 py-3 text-right font-semibold">
                      Precio
                    </th>
                    <th className="px-4 py-3 text-center font-semibold">
                      Stock
                    </th>
                    <th className="px-4 py-3 text-right font-semibold">
                      Precio Live
                    </th>
                    <th className="px-4 py-3 text-center font-semibold">
                      Prio.
                    </th>
                    <th className="px-4 py-3 text-center font-semibold">
                      Visible
                    </th>
                    <th className="px-4 py-3 text-right font-semibold">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dark-border">
                  {loading ? (
                    <tr>
                      <td
                        colSpan={11}
                        className="px-4 py-12 text-center text-text-muted"
                      >
                        Cargando...
                      </td>
                    </tr>
                  ) : pageItems.length === 0 ? (
                    <tr>
                      <td
                        colSpan={11}
                        className="px-4 py-12 text-center text-text-muted"
                      >
                        No hay productos.
                      </td>
                    </tr>
                  ) : (
                    pageItems.map((product) => {
                      const finalPrice = product.discountPercentage
                        ? Number(product.price) *
                          (1 - Number(product.discountPercentage) / 100)
                        : Number(product.price);
                      const lowStock =
                        product.stock > 0 && product.stock <= 5;
                      const outOfStock = product.stock === 0;
                      return (
                        <tr key={product.id} className="hover:bg-dark-surfaceHover">
                          <td className="px-4 py-3">
                            {product.imageUrl ? (
                              <img
                                src={product.imageUrl}
                                alt={product.name}
                                className="w-12 h-12 object-cover rounded-lg border border-dark-border"
                              />
                            ) : (
                              <div className="w-12 h-12 bg-dark-surfaceHover rounded-lg border border-dark-border flex items-center justify-center text-text-muted text-xs">
                                –
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 font-medium text-text-primary">
                            <div className="line-clamp-2 max-w-[300px]">
                              {product.name}
                            </div>
                            <div className="text-xs text-text-muted font-mono">
                              {product.slug}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-text-secondary">
                            {product.type || '—'}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="inline-flex items-center gap-1.5">
                              <img
                                src={LANGUAGE_FLAGS[product.language]}
                                alt={LANGUAGE_LABELS[product.language]}
                                className="w-5 h-3 object-cover rounded-sm"
                              />
                              <span className="text-xs text-text-secondary">
                                {LANGUAGE_LABELS[product.language] ??
                                  product.language}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            {product.discountPercentage ? (
                              <div>
                                <div className="font-bold text-text-primary">
                                  {currency.format(finalPrice)}
                                </div>
                                <div className="text-xs text-text-muted line-through">
                                  {currency.format(Number(product.price))}
                                </div>
                              </div>
                            ) : (
                              <span className="font-bold text-text-primary">
                                {currency.format(Number(product.price))}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span
                              className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
                                outOfStock
                                  ? 'bg-danger-bg text-danger'
                                  : lowStock
                                  ? 'bg-warning-bg text-warning'
                                  : 'bg-success-bg text-success'
                              }`}
                            >
                              {product.stock}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            {product.liveOpeningPrice != null ? (
                              <span className="font-bold text-text-primary">
                                {currency.format(Number(product.liveOpeningPrice))}
                              </span>
                            ) : (
                              <span className="text-text-muted">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center text-gray-600">
                            {product.priority}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {product.visible ? (
                              <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold bg-success-bg text-success">
                                Sí
                              </span>
                            ) : (
                              <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold bg-dark-surfaceHover text-text-secondary">
                                No
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-2">
                              <button
                                onClick={() => handleEdit(product)}
                                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-dark-surfaceHover text-text-primary hover:bg-dark-borderStrong transition-colors"
                              >
                                Editar
                              </button>
                              <button
                                onClick={() => handleDuplicate(product)}
                                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-dark-surfaceHover text-premium-gold hover:bg-dark-borderStrong transition-colors"
                                title="Crear una copia de este producto"
                              >
                                Duplicar
                              </button>
                              <button
                                onClick={() => handleDelete(product.id)}
                                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-dark-surfaceHover text-danger hover:bg-dark-borderStrong transition-colors"
                              >
                                Eliminar
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          <div className="flex flex-wrap items-center justify-between gap-4 mt-6">
            <p className="text-sm text-text-secondary">
              Página {safePage} de {totalPages}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(1)}
                disabled={safePage <= 1}
                className="px-3 py-2 text-sm border border-dark-border rounded-lg bg-dark-surface hover:bg-dark-surfaceHover disabled:opacity-40 disabled:cursor-not-allowed text-text-primary"
              >
                «
              </button>
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage <= 1}
                className="px-3 py-2 text-sm border border-dark-border rounded-lg bg-dark-surface hover:bg-dark-surfaceHover disabled:opacity-40 disabled:cursor-not-allowed text-text-primary"
              >
                ‹ Anterior
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
                className="px-3 py-2 text-sm border border-dark-border rounded-lg bg-dark-surface hover:bg-dark-surfaceHover disabled:opacity-40 disabled:cursor-not-allowed text-text-primary"
              >
                Siguiente ›
              </button>
              <button
                onClick={() => setPage(totalPages)}
                disabled={safePage >= totalPages}
                className="px-3 py-2 text-sm border border-dark-border rounded-lg bg-dark-surface hover:bg-dark-surfaceHover disabled:opacity-40 disabled:cursor-not-allowed text-text-primary"
              >
                »
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
