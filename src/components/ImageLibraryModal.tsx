'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface LibraryImage {
  key: string;
  filename: string;
  publicUrl: string;
  size: number;
  createdAt: string;
}

interface ImageLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (url: string) => void;
}

export function ImageLibraryModal({ isOpen, onClose, onSelect }: ImageLibraryModalProps) {
  const [images, setImages] = useState<LibraryImage[]>([]);
  const [nextToken, setNextToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadedRef = useRef(false);

  const loadPage = useCallback(async (token: string | null) => {
    setLoading(true);
    setError(null);
    try {
      const query = token ? `?continuationToken=${encodeURIComponent(token)}` : '';
      const response = await fetch(`/api/admin/r2-images${query}`);
      const data = (await response.json()) as {
        images?: LibraryImage[];
        continuationToken?: string | null;
        error?: string;
      };
      if (!response.ok || !data.images) throw new Error(data.error || 'No se pudieron cargar las imágenes.');
      setImages((current) => (token ? [...current, ...(data.images ?? [])] : data.images ?? []));
      setNextToken(data.continuationToken ?? null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'No se pudieron cargar las imágenes.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen && !loadedRef.current) {
      loadedRef.current = true;
      void loadPage(null);
    }
  }, [isOpen, loadPage]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="image-library-title"
        className="flex max-h-[85vh] w-full max-w-4xl flex-col rounded-xl border border-dark-border bg-dark-surface p-6"
      >
        <div className="flex items-center justify-between gap-4">
          <h2 id="image-library-title" className="text-lg font-semibold text-text-primary">
            Biblioteca de imágenes
          </h2>
          <button type="button" onClick={onClose} className="btn btn-secondary" autoFocus>
            Cerrar
          </button>
        </div>

        <div className="mt-4 flex-1 overflow-y-auto">
          {error && (
            <p role="alert" className="rounded-lg border border-red-800/50 bg-red-950/40 p-3 text-sm text-red-300">
              {error}
            </p>
          )}

          {!loading && !error && images.length === 0 && (
            <p className="text-text-muted">No hay imágenes en la biblioteca.</p>
          )}

          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {images.map((image) => (
              <li key={image.key}>
                <button
                  type="button"
                  onClick={() => {
                    onSelect(image.publicUrl);
                    onClose();
                  }}
                  aria-label={`Seleccionar ${image.filename}`}
                  className="w-full overflow-hidden rounded-lg border border-dark-border text-left hover:border-premium-gold focus:outline-none focus-visible:ring-2 focus-visible:ring-premium-gold"
                >
                  <img src={image.publicUrl} alt="" loading="lazy" className="aspect-square w-full object-cover" />
                  <span className="block truncate px-2 py-1 text-xs text-text-muted">{image.filename}</span>
                </button>
              </li>
            ))}
          </ul>

          {loading && (
            <p aria-live="polite" className="mt-4 text-text-muted">
              Cargando...
            </p>
          )}

          {nextToken && !loading && (
            <div className="mt-4 flex justify-center">
              <button type="button" onClick={() => void loadPage(nextToken)} className="btn btn-secondary">
                Cargar más
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
