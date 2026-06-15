'use client';

import { useEffect, useState } from 'react';
import { Product, HitCard } from '@/types';
import { ImageUpload } from './ImageUpload';
import { HitCardForm } from './HitCardForm';

interface ProductFormProps {
  product?: Product;
  onSuccess: () => void;
}

const PRODUCT_TYPES = [
  { value: '', label: 'Selecciona un tipo' },
  { value: 'Booster Box', label: 'Booster Box' },
  { value: 'Booster Bundle', label: 'Booster Bundle' },
  { value: 'Booster Pack', label: 'Booster Pack' },
  { value: 'Single Card', label: 'Carta individual' },
];

const LANGUAGES = [
  { value: 'ENGLISH', label: 'Inglés' },
  { value: 'JAPANESE', label: 'Japonés' },
  { value: 'KOREAN', label: 'Coreano' },
  { value: 'SPANISH', label: 'Español' },
];

function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <header className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
        <h3 className="text-base font-bold text-gray-900">{title}</h3>
        {description && (
          <p className="text-xs text-gray-500 mt-0.5">{description}</p>
        )}
      </header>
      <div className="p-6 space-y-5">{children}</div>
    </section>
  );
}

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-1.5">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-gray-500 mt-1.5">{hint}</p>}
    </div>
  );
}

const inputClass =
  'w-full bg-white border border-gray-300 rounded-lg px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-colors disabled:bg-gray-50 disabled:text-gray-500';

export function ProductForm({ product, onSuccess }: ProductFormProps) {
  const [formData, setFormData] = useState({
    name: product?.name || '',
    description: product?.description || '',
    price: product?.price ?? '',
    discountPercentage: product?.discountPercentage ?? '',
    notes: product?.notes || '',
    type: product?.type || '',
    releaseDate: product?.releaseDate ? product.releaseDate.slice(0, 10) : '',
    stock: product?.stock ?? '',
    imageUrl: product?.imageUrl || '',
    language: product?.language || 'ENGLISH',
    priority: product?.priority ?? 999,
    visible: product?.visible ?? true,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [hitCards, setHitCards] = useState<HitCard[]>([]);
  const [showHitCardForm, setShowHitCardForm] = useState(false);
  const [editingHitCard, setEditingHitCard] = useState<HitCard | null>(null);
  const [loadingHitCards, setLoadingHitCards] = useState(false);

  useEffect(() => {
    if (product?.id) {
      fetchHitCards();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?.id]);

  const fetchHitCards = async () => {
    if (!product?.id) return;
    setLoadingHitCards(true);
    try {
      const response = await fetch(
        `/api/admin/products/${product.id}/hit-cards`,
      );
      if (response.ok) {
        const data = await response.json();
        setHitCards(data);
      }
    } catch (err) {
      console.error('Failed to fetch hit cards:', err);
    } finally {
      setLoadingHitCards(false);
    }
  };

  const handleDeleteHitCard = async (id: string) => {
    if (!confirm('¿Eliminar esta hit card?')) return;
    try {
      const response = await fetch(`/api/admin/hit-cards/${id}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        setHitCards(hitCards.filter((h) => h.id !== id));
      }
    } catch (err) {
      console.error('Failed to delete hit card:', err);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleImageUpload = (url: string) => {
    setFormData((prev) => ({ ...prev, imageUrl: url }));
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (
        !formData.name ||
        !formData.description ||
        formData.price === '' ||
        formData.stock === ''
      ) {
        setError('Nombre, descripción, precio y stock son obligatorios.');
        setLoading(false);
        return;
      }

      const method = product ? 'PUT' : 'POST';
      const url = product
        ? `/api/admin/products/${product.id}`
        : '/api/admin/products';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description,
          price: parseFloat(String(formData.price)),
          discountPercentage:
            formData.discountPercentage === '' ||
            formData.discountPercentage === null
              ? null
              : parseFloat(String(formData.discountPercentage)),
          notes: formData.notes || null,
          type: formData.type || null,
          releaseDate: formData.releaseDate || null,
          stock: parseInt(String(formData.stock), 10),
          imageUrl: formData.imageUrl || null,
          language: formData.language,
          priority: parseInt(String(formData.priority), 10) || 999,
          visible: formData.visible,
        }),
      });

      if (response.ok) {
        onSuccess();
      } else {
        const data = await response.json();
        setError(data.error || 'No se pudo guardar el producto');
      }
    } catch (err) {
      setError('Ha ocurrido un error. Inténtalo de nuevo.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const isNewProduct = !product?.id;

  const previewFinalPrice =
    formData.price !== '' && Number(formData.price) >= 0
      ? formData.discountPercentage !== '' &&
        Number(formData.discountPercentage) > 0
        ? Number(formData.price) *
          (1 - Number(formData.discountPercentage) / 100)
        : Number(formData.price)
      : null;

  return (
    <div className="space-y-6">
      {/* Header banner */}
      <div className="bg-gradient-to-r from-red-600 to-red-500 rounded-xl shadow-lg p-6 text-white">
        <h2 className="text-2xl font-bold tracking-tight">
          {product ? 'Editar producto' : 'Nuevo producto'}
        </h2>
        <p className="text-red-100 text-sm mt-1">
          {product
            ? 'Modifica los detalles y guarda los cambios.'
            : 'Rellena los campos para añadir un nuevo producto al catálogo.'}
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <span className="text-red-500 text-lg leading-none">⚠</span>
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column — main fields */}
          <div className="lg:col-span-2 space-y-6">
            <FormSection
              title="Información básica"
              description="Datos principales del producto que aparecerán en el catálogo."
            >
              <Field label="Nombre del producto" required>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Ej.: Charizard EX Holographic"
                  required
                  className={inputClass}
                  disabled={loading}
                />
              </Field>

              <Field label="Descripción" required>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  placeholder="Descripción detallada, condición, edición..."
                  required
                  rows={5}
                  className={inputClass + ' resize-y'}
                  disabled={loading}
                />
              </Field>

              <div className="grid md:grid-cols-2 gap-4">
                <Field label="Tipo de producto">
                  <select
                    name="type"
                    value={formData.type}
                    onChange={handleChange}
                    className={inputClass}
                    disabled={loading}
                  >
                    {PRODUCT_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Idioma" required>
                  <select
                    name="language"
                    value={formData.language}
                    onChange={handleChange}
                    required
                    className={inputClass}
                    disabled={loading}
                  >
                    {LANGUAGES.map((l) => (
                      <option key={l.value} value={l.value}>
                        {l.label}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <Field
                label="Fecha de lanzamiento"
                hint="Opcional. Si es futura, el producto se mostrará como reserva."
              >
                <input
                  type="date"
                  name="releaseDate"
                  value={formData.releaseDate}
                  onChange={handleChange}
                  className={inputClass}
                  disabled={loading}
                />
              </Field>
            </FormSection>

            <FormSection
              title="Precio e inventario"
              description="Configura el precio público, descuentos y disponibilidad."
            >
              <div className="grid md:grid-cols-2 gap-4">
                <Field label="Precio (€)" required>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                      €
                    </span>
                    <input
                      type="number"
                      name="price"
                      value={formData.price}
                      onChange={handleChange}
                      step="0.01"
                      min="0"
                      placeholder="199.99"
                      required
                      className={inputClass + ' pl-7'}
                      disabled={loading}
                    />
                  </div>
                </Field>
                <Field label="Descuento (%)" hint="Opcional. 0 - 100.">
                  <div className="relative">
                    <input
                      type="number"
                      name="discountPercentage"
                      value={formData.discountPercentage}
                      onChange={handleChange}
                      step="0.01"
                      min="0"
                      max="100"
                      placeholder="Ej.: 20"
                      className={inputClass + ' pr-8'}
                      disabled={loading}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                      %
                    </span>
                  </div>
                </Field>
              </div>

              {previewFinalPrice !== null &&
                Number(formData.discountPercentage) > 0 && (
                  <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm flex items-center justify-between">
                    <span className="text-green-700 font-medium">
                      Precio final con descuento
                    </span>
                    <span className="font-bold text-green-700">
                      {previewFinalPrice.toFixed(2)}€
                    </span>
                  </div>
                )}

              <div className="grid md:grid-cols-2 gap-4">
                <Field label="Stock" required>
                  <input
                    type="number"
                    name="stock"
                    value={formData.stock}
                    onChange={handleChange}
                    min="0"
                    placeholder="0"
                    required
                    className={inputClass}
                    disabled={loading}
                  />
                </Field>
                <Field
                  label="Prioridad"
                  hint="Menor número = aparece antes. Por defecto 999."
                >
                  <input
                    type="number"
                    name="priority"
                    value={formData.priority}
                    onChange={handleChange}
                    min="0"
                    placeholder="999"
                    className={inputClass}
                    disabled={loading}
                  />
                </Field>
              </div>
            </FormSection>

            <FormSection
              title="Detalles adicionales"
              description="Notas que aparecerán como puntos en la página del producto."
            >
              <Field
                label="Notas"
                hint="Separa con comas. Cada nota será un punto en la página del producto."
              >
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleChange}
                  placeholder="Ej.: Edición limitada, Primera tirada, Holográfica"
                  rows={3}
                  className={inputClass + ' resize-y'}
                  disabled={loading}
                />
              </Field>
            </FormSection>
          </div>

          {/* Right column — image + visibility */}
          <div className="space-y-6">
            <FormSection
              title="Imagen del producto"
              description="JPG, PNG o WebP. Máximo 5 MB."
            >
              {formData.imageUrl ? (
                <div className="space-y-3">
                  <div className="relative bg-gray-50 rounded-lg border border-gray-200 overflow-hidden aspect-square">
                    <img
                      src={formData.imageUrl}
                      alt="Vista previa"
                      className="w-full h-full object-contain p-3"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setFormData((prev) => ({ ...prev, imageUrl: '' }))
                      }
                      className="absolute top-2 right-2 bg-white/90 hover:bg-white border border-gray-200 rounded-full px-3 py-1 text-xs font-semibold text-gray-700 shadow-sm"
                    >
                      Quitar
                    </button>
                  </div>
                  <ImageUpload onUpload={handleImageUpload} />
                </div>
              ) : (
                <ImageUpload onUpload={handleImageUpload} />
              )}
            </FormSection>

            <FormSection title="Visibilidad">
              <label
                htmlFor="visible"
                className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  formData.visible
                    ? 'border-red-500 bg-red-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <input
                  type="checkbox"
                  id="visible"
                  checked={formData.visible}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      visible: e.target.checked,
                    }))
                  }
                  disabled={loading}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
                />
                <div>
                  <div className="text-sm font-semibold text-gray-900">
                    Visible en el catálogo público
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    Si está desactivado, el producto se ocultará a los clientes
                    pero seguirá guardado.
                  </div>
                </div>
              </label>
            </FormSection>
          </div>
        </div>

        {/* Sticky action bar */}
        <div className="sticky bottom-4 z-10 bg-white rounded-xl shadow-lg border border-gray-200 px-6 py-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-gray-500">
            Los campos marcados con
            <span className="text-red-500 mx-1">*</span>
            son obligatorios.
          </p>
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary px-6"
            >
              {loading
                ? 'Guardando...'
                : product
                ? 'Guardar cambios'
                : 'Crear producto'}
            </button>
          </div>
        </div>
      </form>

      {/* Hit Cards section — only after product creation */}
      {!isNewProduct && product && (
        <FormSection
          title="Hit Cards"
          description="Cartas destacadas que pueden aparecer en este producto."
        >
          {showHitCardForm && (
            <div className="mb-4">
              <HitCardForm
                productId={product.id}
                hitCard={editingHitCard || undefined}
                onSuccess={() => {
                  setShowHitCardForm(false);
                  setEditingHitCard(null);
                  fetchHitCards();
                }}
                onCancel={() => {
                  setShowHitCardForm(false);
                  setEditingHitCard(null);
                }}
              />
            </div>
          )}

          {!showHitCardForm && (
            <button
              type="button"
              onClick={() => {
                setEditingHitCard(null);
                setShowHitCardForm(true);
              }}
              className="btn btn-primary text-sm"
            >
              + Añadir hit card
            </button>
          )}

          {loadingHitCards ? (
            <p className="text-gray-600 text-sm">Cargando hit cards...</p>
          ) : hitCards.length === 0 ? (
            <p className="text-gray-500 text-sm">
              Aún no hay hit cards añadidas.
            </p>
          ) : (
            <div className="grid gap-3">
              {hitCards.map((hitCard) => (
                <div
                  key={hitCard.id}
                  className="bg-gray-50 border border-gray-200 rounded-lg p-3 flex justify-between items-start gap-3"
                >
                  <div className="flex gap-3">
                    <img
                      src={hitCard.imageUrl}
                      alt={hitCard.name}
                      className="w-16 h-22 object-cover rounded border border-gray-300"
                    />
                    <div>
                      <h4 className="font-semibold text-gray-900 text-sm mb-1">
                        {hitCard.name}
                      </h4>
                      <p className="text-xs text-gray-600">
                        Tipo: {hitCard.type}
                      </p>
                      <p className="text-xs text-gray-600">
                        Precio de mercado: €
                        {Number(hitCard.marketPrice).toFixed(2)}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingHitCard(hitCard);
                        setShowHitCardForm(true);
                      }}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteHitCard(hitCard.id)}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </FormSection>
      )}
    </div>
  );
}
