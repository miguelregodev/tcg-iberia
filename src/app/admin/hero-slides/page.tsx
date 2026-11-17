'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { HeroSlideContent, HERO_DEFAULT_BUTTON_LABEL } from '@/components/HeroSlideContent';
import { AdminNav } from '@/components/AdminNav';
import { ImageLibraryModal } from '@/components/ImageLibraryModal';
import type { HeroSlide } from '@/types';

const PAGE_SHORTCUTS = [
  { value: '/', label: 'Inicio' },
  { value: '/#shop-by-category', label: 'Productos' },
  { value: '/booster-boxes', label: 'Booster Boxes' },
  { value: '/cart', label: 'Carrito' },
];

interface SlideFormState {
  name: string;
  imageUrl: string;
  destinationUrl: string;
  headline: string;
  buttonLabel: string;
  subtitle: string;
  sortOrder: string;
  isActive: boolean;
}

const EMPTY_FORM: SlideFormState = {
  name: '',
  imageUrl: '',
  destinationUrl: '/',
  headline: '',
  buttonLabel: '',
  subtitle: '',
  sortOrder: '',
  isActive: true,
};

async function readError(res: Response, fallback: string): Promise<string> {
  try {
    const data = (await res.json()) as { error?: string };
    return data.error ?? fallback;
  } catch {
    return fallback;
  }
}

export default function AdminHeroSlidesPage() {
  const [slides, setSlides] = useState<HeroSlide[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<SlideFormState>(EMPTY_FORM);
  const [previewSlide, setPreviewSlide] = useState<HeroSlide | null>(null);

  const draggingIndex = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Data ───────────────────────────────────────────────────────────────────

  const fetchSlides = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/hero-slides');
      if (!res.ok) throw new Error();
      const data: HeroSlide[] = await res.json();
      setSlides(data);
    } catch {
      setError('No se pudieron cargar las diapositivas.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSlides();
  }, [fetchSlides]);

  // Close preview with Escape
  useEffect(() => {
    if (!previewSlide) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPreviewSlide(null);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [previewSlide]);

  // ── Form helpers ───────────────────────────────────────────────────────────

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError(null);
    setNotice(null);
    setShowForm(true);
  };

  const openEdit = (slide: HeroSlide) => {
    setEditingId(slide.id);
    setForm({
      name: slide.name,
      imageUrl: slide.imageUrl,
      destinationUrl: slide.destinationUrl,
      headline: slide.headline ?? '',
      buttonLabel: slide.buttonLabel ?? '',
      subtitle: slide.subtitle ?? '',
      sortOrder: String(slide.sortOrder),
      isActive: slide.isActive,
    });
    setError(null);
    setNotice(null);
    setShowForm(true);
  };

  const cancelForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const handleUpload = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const body = new FormData();
      body.append('file', file);
      const res = await fetch('/api/admin/hero-slides/image', { method: 'POST', body });
      if (!res.ok) {
        setError(await readError(res, 'Error al subir la imagen.'));
        return;
      }
      const data: { url: string; width: number; height: number } = await res.json();
      setForm((prev) => ({ ...prev, imageUrl: data.url }));
      setNotice(`Imagen subida (${data.width}×${data.height}).`);
    } catch {
      setError('Error al subir la imagen.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // ── CRUD ───────────────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);

    const name = form.name.trim();
    const imageUrl = form.imageUrl.trim();
    const destinationUrl = form.destinationUrl.trim();
    const headline = form.headline.trim();
    const buttonLabel = form.buttonLabel.trim();
    const subtitle = form.subtitle.trim();
    if (!name) return setError('El nombre es obligatorio.');
    if (!imageUrl) return setError('Sube una imagen para la diapositiva.');
    if (!destinationUrl) return setError('El destino es obligatorio.');
    if (headline.length > 160) return setError('El texto no puede superar 160 caracteres.');
    if (buttonLabel.length > 60) return setError('El texto del botón no puede superar 60 caracteres.');
    if (subtitle.length > 240) return setError('El subtítulo no puede superar 240 caracteres.');

    const payload: Record<string, unknown> = {
      name,
      imageUrl,
      destinationUrl,
      headline: headline || null,
      buttonLabel: buttonLabel || null,
      subtitle: subtitle || null,
      isActive: form.isActive,
    };
    if (form.sortOrder.trim() !== '') {
      const parsed = Number(form.sortOrder);
      if (!Number.isInteger(parsed) || parsed < 0) {
        return setError('La posición debe ser un número entero mayor o igual a 0.');
      }
      payload.sortOrder = parsed;
    }

    setSaving(true);
    try {
      if (editingId) {
        const res = await fetch(`/api/admin/hero-slides/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          setError(await readError(res, 'Error al guardar la diapositiva.'));
          return;
        }
      } else {
        const res = await fetch('/api/admin/hero-slides', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          setError(await readError(res, 'Error al crear la diapositiva.'));
          return;
        }
      }
      cancelForm();
      await fetchSlides();
    } catch {
      setError('Error de red al guardar la diapositiva.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (slide: HeroSlide) => {
    if (!confirm(`¿Eliminar la diapositiva "${slide.name}"? La imagen se conservará en el almacenamiento.`)) return;
    try {
      const res = await fetch(`/api/admin/hero-slides/${slide.id}`, { method: 'DELETE' });
      if (!res.ok) {
        setError(await readError(res, 'Error al eliminar la diapositiva.'));
        return;
      }
      setSlides((prev) => prev.filter((s) => s.id !== slide.id));
    } catch {
      setError('Error al eliminar la diapositiva.');
    }
  };

  const handleToggleActive = async (slide: HeroSlide) => {
    try {
      const res = await fetch(`/api/admin/hero-slides/${slide.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !slide.isActive }),
      });
      if (!res.ok) {
        setError(await readError(res, 'Error al actualizar la diapositiva.'));
        return;
      }
      const updated: HeroSlide = await res.json();
      setSlides((prev) => prev.map((s) => (s.id === slide.id ? updated : s)));
    } catch {
      setError('Error al actualizar la diapositiva.');
    }
  };

  // ── Drag to reorder ────────────────────────────────────────────────────────

  const handleDragStart = (index: number) => {
    draggingIndex.current = index;
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    const from = draggingIndex.current;
    if (from === null || from === index) return;
    setSlides((prev) => {
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(index, 0, item);
      draggingIndex.current = index;
      return next;
    });
  };

  const handleDragEnd = async () => {
    draggingIndex.current = null;
    try {
      const res = await fetch('/api/admin/hero-slides', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: slides.map((s) => s.id) }),
      });
      if (!res.ok) {
        setError(await readError(res, 'Error al guardar el orden.'));
        await fetchSlides();
        return;
      }
      const ordered: HeroSlide[] = await res.json();
      setSlides(ordered);
    } catch {
      setError('Error al guardar el orden.');
      await fetchSlides();
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  const inputClass =
    'w-full rounded-lg border border-dark-border bg-dark-bgSecondary px-3 py-2 text-sm text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-dark-gold';

  return (
    <div className="min-h-screen bg-dark-bg">
      <AdminNav />

      <div className="container-custom px-4 py-8 max-w-5xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Hero de la Home</h1>
            <p className="mt-1 text-sm text-text-secondary">
              Las diapositivas activas se muestran en rotación en la portada. Arrastra para reordenar.
              Si no hay diapositivas activas, se muestra el hero estático.
            </p>
          </div>
          {!showForm && (
            <button onClick={openCreate} className="btn btn-primary text-sm">
              + Nueva diapositiva
            </button>
          )}
        </div>

        {error && (
          <div role="alert" className="mb-4 rounded-lg bg-danger-bg border border-danger px-4 py-3 text-sm text-danger">
            {error}
          </div>
        )}
        {notice && (
          <div aria-live="polite" className="mb-4 rounded-lg border border-dark-border px-4 py-3 text-sm text-text-primary">
            {notice}
          </div>
        )}

        {showForm && (
          <form
            onSubmit={handleSubmit}
            className="mb-8 space-y-4 rounded-xl border border-dark-border bg-dark-bgSecondary p-6"
            aria-labelledby="hero-form-title"
          >
            <h2 id="hero-form-title" className="text-lg font-semibold text-text-primary">
              {editingId ? 'Editar diapositiva' : 'Nueva diapositiva'}
            </h2>

            <div>
              <label htmlFor="hero-name" className="block mb-1 text-sm text-text-secondary">
                Nombre interno
              </label>
              <input
                id="hero-name"
                className={inputClass}
                maxLength={255}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>

            <div>
              <span className="block mb-1 text-sm text-text-secondary">
                Imagen (mínimo 1280 px de ancho, proporción 16:9 o 16:10, máximo 5 MB; JPG, PNG o WebP)
              </span>
              {form.imageUrl && (
                <img
                  src={form.imageUrl}
                  alt="Vista previa de la imagen seleccionada"
                  className="mb-2 aspect-[16/9] w-full max-w-md rounded-lg object-cover"
                />
              )}
              <input
                ref={fileInputRef}
                id="hero-image"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={uploading}
                className="text-sm text-text-secondary file:mr-3 file:rounded-lg file:border-0 file:bg-dark-gold file:px-3 file:py-2 file:text-dark-bg"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleUpload(file);
                }}
              />
              {uploading && <p className="mt-1 text-sm text-text-secondary">Subiendo imagen…</p>}
              <button type="button" onClick={() => setLibraryOpen(true)} disabled={uploading} className="btn btn-secondary mt-2">
                Seleccionar de la biblioteca
              </button>
              <ImageLibraryModal
                isOpen={libraryOpen}
                onClose={() => setLibraryOpen(false)}
                onSelect={(url) => setForm((prev) => ({ ...prev, imageUrl: url }))}
              />
            </div>

            <div>
              <label htmlFor="hero-destination-shortcut" className="block mb-1 text-sm text-text-secondary">
                Destino (atajo)
              </label>
              <select
                id="hero-destination-shortcut"
                className={inputClass}
                value={PAGE_SHORTCUTS.some((p) => p.value === form.destinationUrl) ? form.destinationUrl : ''}
                onChange={(e) => {
                  if (e.target.value) setForm({ ...form, destinationUrl: e.target.value });
                }}
              >
                <option value="">Personalizado</option>
                {PAGE_SHORTCUTS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="hero-destination" className="block mb-1 text-sm text-text-secondary">
                URL de destino
              </label>
              <input
                id="hero-destination"
                className={inputClass}
                maxLength={500}
                value={form.destinationUrl}
                onChange={(e) => setForm({ ...form, destinationUrl: e.target.value })}
                placeholder="/products o https://..."
                required
              />
              <p className="mt-1 text-xs text-text-secondary">
                Rutas internas empiezan por &quot;/&quot;. Enlaces externos deben usar https://.
              </p>
            </div>

            <div>
              <label htmlFor="hero-headline" className="block mb-1 text-sm text-text-secondary">
                Título H1 (opcional)
              </label>
              <input
                id="hero-headline"
                className={inputClass}
                maxLength={160}
                value={form.headline}
                onChange={(e) => setForm({ ...form, headline: e.target.value })}
                placeholder="Ej.: Nuevas llegadas Pokémon"
              />
              <p className="mt-1 text-xs text-text-secondary">
                Se muestra centrado sobre el botón, con el mismo estilo que el Hero de inicio. Máximo 160 caracteres.
              </p>
            </div>

            <div>
              <label htmlFor="hero-subtitle" className="block mb-1 text-sm text-text-secondary">
                Subtítulo (opcional, párrafo)
              </label>
              <input
                id="hero-subtitle"
                className={inputClass}
                maxLength={240}
                value={form.subtitle}
                onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
              />
              <p className="mt-1 text-xs text-text-secondary">Máximo 240 caracteres.</p>
            </div>

            <div>
              <label htmlFor="hero-button-label" className="block mb-1 text-sm text-text-secondary">
                Texto del botón (opcional)
              </label>
              <input
                id="hero-button-label"
                className={inputClass}
                maxLength={60}
                value={form.buttonLabel}
                onChange={(e) => setForm({ ...form, buttonLabel: e.target.value })}
                placeholder={HERO_DEFAULT_BUTTON_LABEL}
              />
              <p className="mt-1 text-xs text-text-secondary">
                Vacío muestra &quot;{HERO_DEFAULT_BUTTON_LABEL}&quot;. Máximo 60 caracteres.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="hero-position" className="block mb-1 text-sm text-text-secondary">
                  Posición (opcional, 0 = primera)
                </label>
                <input
                  id="hero-position"
                  type="number"
                  min={0}
                  step={1}
                  className={inputClass}
                  value={form.sortOrder}
                  onChange={(e) => setForm({ ...form, sortOrder: e.target.value })}
                />
              </div>
              <div className="flex items-end">
                <label htmlFor="hero-active" className="flex items-center gap-2 text-sm text-text-primary">
                  <input
                    id="hero-active"
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                  />
                  Activa (visible en la portada)
                </label>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button type="submit" disabled={saving || uploading} className="btn btn-primary text-sm disabled:opacity-50">
                {saving ? 'Guardando…' : editingId ? 'Guardar cambios' : 'Crear diapositiva'}
              </button>
              <button type="button" onClick={cancelForm} className="btn text-sm">
                Cancelar
              </button>
            </div>
          </form>
        )}

        {loading ? (
          <p className="text-text-secondary">Cargando…</p>
        ) : slides.length === 0 ? (
          <p className="text-text-secondary">No hay diapositivas. Se mostrará el hero estático.</p>
        ) : (
          <ul className="space-y-3" aria-label="Diapositivas del hero">
            {slides.map((slide, index) => (
              <li
                key={slide.id}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragEnd={handleDragEnd}
                className="flex flex-col gap-4 rounded-xl border border-dark-border bg-dark-bgSecondary p-4 sm:flex-row sm:items-center cursor-move"
              >
                <span className="text-sm font-mono text-text-secondary w-8 shrink-0">#{index + 1}</span>
                <img
                  src={slide.imageUrl}
                  alt=""
                  className="aspect-[16/9] w-40 shrink-0 rounded-md object-cover"
                  loading="lazy"
                />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-text-primary truncate">{slide.name}</p>
                  <p className="text-sm text-text-secondary truncate">{slide.destinationUrl}</p>
                  <p className="text-sm text-text-secondary truncate">
                    {slide.subtitle ? `Subtítulo: ${slide.subtitle}` : 'Sin subtítulo'}
                  </p>
                  <p className="text-sm text-text-secondary truncate">
                    {slide.headline ? `Título: ${slide.headline}` : 'Sin título'}
                  </p>
                  <p className="text-sm text-text-secondary truncate">
                    Botón: {slide.buttonLabel || HERO_DEFAULT_BUTTON_LABEL}
                  </p>
                  <p className="text-xs text-text-secondary">
                    {slide.isActive ? 'Activa' : 'Inactiva'} · Actualizada{' '}
                    {new Date(slide.updatedAt).toLocaleDateString('es-ES')}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setPreviewSlide(slide)}
                    className="btn text-sm"
                    aria-label={`Previsualizar ${slide.name}`}
                  >
                    Ver
                  </button>
                  <button
                    type="button"
                    onClick={() => openEdit(slide)}
                    className="btn text-sm"
                    aria-label={`Editar ${slide.name}`}
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleActive(slide)}
                    aria-pressed={slide.isActive}
                    className="btn text-sm"
                  >
                    {slide.isActive ? 'Desactivar' : 'Activar'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(slide)}
                    className="btn text-sm text-danger"
                    aria-label={`Eliminar ${slide.name}`}
                  >
                    Eliminar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {previewSlide && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Vista previa: ${previewSlide.name}`}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setPreviewSlide(null)}
        >
          <div className="w-full max-w-4xl" onClick={(e) => e.stopPropagation()}>
            <section className="relative w-full h-[60vh] min-h-[440px] max-h-[820px] overflow-hidden bg-dark-bgSecondary rounded-lg border border-dark-border">
              <img
                src={previewSlide.imageUrl}
                alt=""
                className="absolute inset-0 h-full w-full object-cover object-center"
              />
              <HeroSlideContent
                headline={previewSlide.headline}
                buttonLabel={previewSlide.buttonLabel}
                subtitle={previewSlide.subtitle}
                destinationUrl={previewSlide.destinationUrl}
                tabbable
              />
            </section>
            <div className="mt-3 flex justify-end">
              <button type="button" onClick={() => setPreviewSlide(null)} className="btn text-sm">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
