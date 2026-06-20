'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AdminNav } from '@/components/AdminNav';
import type { AnnouncementBanner } from '@/types';

const MAX_TEXT_LENGTH = 500;

interface BannerFormState {
  text: string;
  enabled: boolean;
}

const EMPTY_FORM: BannerFormState = { text: '', enabled: true };

export default function AdminBannersPage() {
  const [banners, setBanners] = useState<AnnouncementBanner[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Inline form state
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<BannerFormState>(EMPTY_FORM);

  // Drag-to-reorder state
  const draggingIndex = useRef<number | null>(null);

  // ── Data fetching ──────────────────────────────────────────────────────────

  const fetchBanners = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/banners');
      if (!res.ok) throw new Error('Error al cargar banners');
      const data: AnnouncementBanner[] = await res.json();
      setBanners(data);
    } catch {
      setError('No se pudieron cargar los banners.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBanners();
  }, [fetchBanners]);

  // ── Form helpers ───────────────────────────────────────────────────────────

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const openEdit = (banner: AnnouncementBanner) => {
    setEditingId(banner.id);
    setForm({ text: banner.text, enabled: banner.enabled });
    setShowForm(true);
  };

  const cancelForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  // ── CRUD operations ────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = form.text.trim();
    if (!text) return;

    setSaving(true);
    setError(null);
    try {
      if (editingId) {
        const res = await fetch(`/api/admin/banners/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, enabled: form.enabled }),
        });
        if (!res.ok) throw new Error();
        const updated: AnnouncementBanner = await res.json();
        setBanners((prev) => prev.map((b) => (b.id === editingId ? updated : b)));
      } else {
        const nextOrder = banners.length;
        const res = await fetch('/api/admin/banners', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, enabled: form.enabled, displayOrder: nextOrder }),
        });
        if (!res.ok) throw new Error();
        const created: AnnouncementBanner = await res.json();
        setBanners((prev) => [...prev, created]);
      }
      cancelForm();
    } catch {
      setError('Error al guardar el banner.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este banner?')) return;
    try {
      const res = await fetch(`/api/admin/banners/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      setBanners((prev) => prev.filter((b) => b.id !== id));
    } catch {
      setError('Error al eliminar el banner.');
    }
  };

  const handleToggleEnabled = async (banner: AnnouncementBanner) => {
    try {
      const res = await fetch(`/api/admin/banners/${banner.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !banner.enabled }),
      });
      if (!res.ok) throw new Error();
      const updated: AnnouncementBanner = await res.json();
      setBanners((prev) => prev.map((b) => (b.id === banner.id ? updated : b)));
    } catch {
      setError('Error al actualizar el banner.');
    }
  };

  // ── Drag-to-reorder ────────────────────────────────────────────────────────

  const handleDragStart = (index: number) => {
    draggingIndex.current = index;
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    const from = draggingIndex.current;
    if (from === null || from === index) return;

    setBanners((prev) => {
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
      await fetch('/api/admin/banners', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: banners.map((b) => b.id) }),
      });
    } catch {
      setError('Error al guardar el orden.');
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav />

      <div className="container-custom px-4 py-8 max-w-3xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Banners de Anuncios</h1>
            <p className="mt-1 text-sm text-gray-500">
              Los banners activos se muestran en rotación bajo la navegación principal.
              Arrastra para reordenar.
            </p>
          </div>
          {!showForm && (
            <button
              onClick={openCreate}
              className="btn btn-primary text-sm"
            >
              + Nuevo banner
            </button>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Create / Edit form */}
        {showForm && (
          <form
            onSubmit={handleSubmit}
            className="mb-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
          >
            <h2 className="text-base font-semibold text-gray-900 mb-4">
              {editingId ? 'Editar banner' : 'Nuevo banner'}
            </h2>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="banner-text">
                Mensaje
              </label>
              <textarea
                id="banner-text"
                rows={2}
                maxLength={MAX_TEXT_LENGTH}
                required
                value={form.text}
                onChange={(e) => setForm((prev) => ({ ...prev, text: e.target.value }))}
                placeholder='Ej. 🚚 Envío gratuito en pedidos superiores a 200€'
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
              />
              <p className="mt-1 text-xs text-gray-400 text-right">
                {form.text.length}/{MAX_TEXT_LENGTH}
              </p>
            </div>

            <div className="mb-5 flex items-center gap-2">
              <input
                id="banner-enabled"
                type="checkbox"
                checked={form.enabled}
                onChange={(e) => setForm((prev) => ({ ...prev, enabled: e.target.checked }))}
                className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
              />
              <label htmlFor="banner-enabled" className="text-sm text-gray-700">
                Activo (visible en la tienda)
              </label>
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={saving || !form.text.trim()}
                className="btn btn-primary text-sm disabled:opacity-50"
              >
                {saving ? 'Guardando…' : editingId ? 'Guardar cambios' : 'Crear banner'}
              </button>
              <button type="button" onClick={cancelForm} className="btn btn-secondary text-sm">
                Cancelar
              </button>
            </div>
          </form>
        )}

        {/* Banner list */}
        {loading ? (
          <div className="text-center py-16 text-gray-400 text-sm">Cargando banners…</div>
        ) : banners.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white py-16 text-center">
            <p className="text-gray-500 text-sm">No hay banners todavía.</p>
            <button onClick={openCreate} className="mt-3 btn btn-primary text-sm">
              Crear el primero
            </button>
          </div>
        ) : (
          <ul className="space-y-2">
            {banners.map((banner, index) => (
              <li
                key={banner.id}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragEnd={handleDragEnd}
                className="flex items-start gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm cursor-grab active:cursor-grabbing"
              >
                {/* Drag handle */}
                <span
                  className="mt-0.5 text-gray-300 select-none flex-shrink-0"
                  aria-hidden="true"
                  title="Arrastra para reordenar"
                >
                  ⠿
                </span>

                {/* Order badge */}
                <span className="mt-0.5 text-xs text-gray-400 font-mono w-4 flex-shrink-0">
                  {index + 1}
                </span>

                {/* Text */}
                <span className="flex-1 text-sm text-gray-800 break-words">{banner.text}</span>

                {/* Status toggle */}
                <button
                  onClick={() => handleToggleEnabled(banner)}
                  title={banner.enabled ? 'Desactivar' : 'Activar'}
                  className={`flex-shrink-0 inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full transition-colors ${
                    banner.enabled
                      ? 'bg-green-100 text-green-700 hover:bg-green-200'
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  {banner.enabled ? '● Activo' : '○ Inactivo'}
                </button>

                {/* Edit */}
                <button
                  onClick={() => openEdit(banner)}
                  className="flex-shrink-0 text-xs text-gray-500 hover:text-red-600 transition-colors"
                  title="Editar"
                >
                  ✏️
                </button>

                {/* Delete */}
                <button
                  onClick={() => handleDelete(banner.id)}
                  className="flex-shrink-0 text-xs text-gray-400 hover:text-red-600 transition-colors"
                  title="Eliminar"
                >
                  🗑️
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
