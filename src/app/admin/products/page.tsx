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

const dateFormatter = new Intl.DateTimeFormat('es-ES', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
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
      <div className="min-h-screen bg-gray-50">
        <div className="container-custom section">
          <div className="flex flex-wrap justify-between items-center mb-6 gap-4">
            <div>
              <h1 className="text-h2">Productos</h1>
              <p className="text-sm text-gray-500 mt-1">
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
                onSuccess={handleFormSuccess}
              />
            </div>
          )}

          {/* Filters */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
              <div className="lg:col-span-2">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
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
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                  Idioma
                </label>
                <select
                  value={languageFilter}
                  onChange={(e) => {
                    setLanguageFilter(e.target.value);
                    setPage(1);
                  }}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
                >
                  <option value="">Todos</option>
                  <option value="ENGLISH">Inglés</option>
                  <option value="JAPANESE">Japonés</option>
                  <option value="KOREAN">Coreano</option>
                  <option value="SPANISH">Español</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                  Tipo
                </label>
                <select
                  value={typeFilter}
                  onChange={(e) => {
                    setTypeFilter(e.target.value);
                    setPage(1);
                  }}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
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
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
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
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
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
                  className="text-xs text-red-600 hover:text-red-700 font-medium"
                >
                  Limpiar filtros
                </button>
              </div>
            )}
          </div>

          {/* Per-page selector */}
          <div className="flex justify-end mb-3 text-sm">
            <div className="flex items-center gap-2">
              <label htmlFor="pageSize" className="text-gray-600 font-medium">
                Productos por página:
              </label>
              <select
                id="pageSize"
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                className="border border-gray-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
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
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-gray-600 uppercase text-xs tracking-wide">
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
                    <th className="px-4 py-3 text-center font-semibold">
                      Lanzamiento
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
                <tbody className="divide-y divide-gray-200">
                  {loading ? (
                    <tr>
                      <td
                        colSpan={10}
                        className="px-4 py-12 text-center text-gray-500"
                      >
                        Cargando...
                      </td>
                    </tr>
                  ) : pageItems.length === 0 ? (
                    <tr>
                      <td
                        colSpan={10}
                        className="px-4 py-12 text-center text-gray-500"
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
                        <tr key={product.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            {product.imageUrl ? (
                              <img
                                src={product.imageUrl}
                                alt={product.name}
                                className="w-12 h-12 object-cover rounded-lg border border-gray-200"
                              />
                            ) : (
                              <div className="w-12 h-12 bg-gray-100 rounded-lg border border-gray-200 flex items-center justify-center text-gray-400 text-xs">
                                –
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 font-medium text-gray-900">
                            <div className="line-clamp-2 max-w-[300px]">
                              {product.name}
                            </div>
                            <div className="text-xs text-gray-500 font-mono">
                              {product.slug}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-gray-600">
                            {product.type || '—'}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="inline-flex items-center gap-1.5">
                              <img
                                src={LANGUAGE_FLAGS[product.language]}
                                alt={LANGUAGE_LABELS[product.language]}
                                className="w-5 h-3 object-cover rounded-sm"
                              />
                              <span className="text-xs text-gray-600">
                                {LANGUAGE_LABELS[product.language] ??
                                  product.language}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            {product.discountPercentage ? (
                              <div>
                                <div className="font-bold text-gray-900">
                                  {currency.format(finalPrice)}
                                </div>
                                <div className="text-xs text-gray-400 line-through">
                                  {currency.format(Number(product.price))}
                                </div>
                              </div>
                            ) : (
                              <span className="font-bold text-gray-900">
                                {currency.format(Number(product.price))}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span
                              className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
                                outOfStock
                                  ? 'bg-red-100 text-red-700'
                                  : lowStock
                                  ? 'bg-orange-100 text-orange-700'
                                  : 'bg-green-100 text-green-700'
                              }`}
                            >
                              {product.stock}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center text-gray-600 text-xs whitespace-nowrap">
                            {product.releaseDate
                              ? dateFormatter.format(new Date(product.releaseDate))
                              : '—'}
                          </td>
                          <td className="px-4 py-3 text-center text-gray-600">
                            {product.priority}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {product.visible ? (
                              <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                                Sí
                              </span>
                            ) : (
                              <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-600">
                                No
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-2">
                              <button
                                onClick={() => handleEdit(product)}
                                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                              >
                                Editar
                              </button>
                              <button
                                onClick={() => handleDuplicate(product)}
                                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                                title="Crear una copia de este producto"
                              >
                                Duplicar
                              </button>
                              <button
                                onClick={() => handleDelete(product.id)}
                                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
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
            <p className="text-sm text-gray-600">
              Página {safePage} de {totalPages}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(1)}
                disabled={safePage <= 1}
                className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                «
              </button>
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage <= 1}
                className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                ‹ Anterior
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
                className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Siguiente ›
              </button>
              <button
                onClick={() => setPage(totalPages)}
                disabled={safePage >= totalPages}
                className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
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
