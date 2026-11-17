'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ImageLibraryModal } from '@/components/ImageLibraryModal';

export interface LotteryFormValues {
  title: string;
  prize: string;
  description: string;
  prizeImageUrl: string;
  startDate: string;
  endDate: string;
  minimumOrderAmount: string;
}

interface LotteryFormProps {
  lotteryId?: string;
  initialValues: LotteryFormValues;
  /** When true, only content fields and endDate can change (ACTIVE lotteries). */
  startLocked?: boolean;
  /** When true, every field is read-only (FINISHED, DRAWN, CANCELLED). */
  readOnly?: boolean;
}

export const FIELD_CLASS =
  'mt-1 w-full rounded-lg border border-dark-border bg-dark-surface px-3 py-2.5 text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-premium-gold disabled:opacity-60';

/** Formats an ISO date as a `YYYY-MM-DDTHH:mm` value in Europe/Madrid for datetime-local inputs. */
export function toMadridInputValue(iso: string): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '00';
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
}

export default function LotteryForm({ lotteryId, initialValues, startLocked, readOnly }: LotteryFormProps) {
  const router = useRouter();
  const [values, setValues] = useState<LotteryFormValues>(initialValues);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);

  const update = (field: keyof LotteryFormValues) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setValues((current) => ({ ...current, [field]: event.target.value }));

  const uploadImage = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('provider', 'r2');
      const response = await fetch('/api/admin/upload', { method: 'POST', body: formData });
      const result = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !result.url) throw new Error(result.error || 'No se pudo subir la imagen.');
      setValues((current) => ({ ...current, prizeImageUrl: result.url as string }));
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'No se pudo subir la imagen.');
    } finally {
      setUploading(false);
    }
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(lotteryId ? `/api/admin/lotteries/${lotteryId}` : '/api/admin/lotteries', {
        method: lotteryId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      const result = (await response.json()) as { lottery?: { id: string }; error?: string };
      if (!response.ok || !result.lottery) throw new Error(result.error || 'No se pudo guardar el sorteo.');
      if (lotteryId) {
        setNotice('Sorteo actualizado correctamente.');
        router.refresh();
      } else {
        router.push(`/admin/lotteries/${result.lottery.id}`);
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'No se pudo guardar el sorteo.');
    } finally {
      setSaving(false);
    }
  };

  const disabledAll = readOnly || saving;

  return (
    <form onSubmit={submit} className="space-y-5" aria-describedby={error ? 'lottery-form-error' : undefined}>
      {error && (
        <div id="lottery-form-error" role="alert" className="rounded-lg border border-red-800/50 bg-red-950/40 p-3 text-sm text-red-300">
          {error}
        </div>
      )}
      {notice && (
        <div role="status" aria-live="polite" className="rounded-lg border border-success/30 bg-success-bg p-3 text-sm text-success">
          {notice}
        </div>
      )}

      <div>
        <label htmlFor="lottery-title" className="text-sm font-medium text-text-secondary">
          Título
        </label>
        <input id="lottery-title" className={FIELD_CLASS} value={values.title} onChange={update('title')} maxLength={160} required disabled={disabledAll} />
      </div>

      <div>
        <label htmlFor="lottery-prize" className="text-sm font-medium text-text-secondary">
          Premio
        </label>
        <input id="lottery-prize" className={FIELD_CLASS} value={values.prize} onChange={update('prize')} maxLength={255} required disabled={disabledAll} />
      </div>

      <div>
        <label htmlFor="lottery-description" className="text-sm font-medium text-text-secondary">
          Descripción
        </label>
        <textarea id="lottery-description" className={FIELD_CLASS} rows={5} value={values.description} onChange={update('description')} required disabled={disabledAll} />
      </div>

      <div>
        <label htmlFor="lottery-image" className="text-sm font-medium text-text-secondary">
          Imagen del premio (opcional)
        </label>
        <input
          id="lottery-image"
          type="file"
          accept="image/*"
          className="mt-1 block w-full text-sm text-text-secondary"
          disabled={disabledAll || uploading}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void uploadImage(file);
          }}
        />
        {uploading && <p className="mt-1 text-sm text-text-muted">Subiendo imagen...</p>}
        <button
          type="button"
          onClick={() => setLibraryOpen(true)}
          disabled={disabledAll || uploading}
          className="btn btn-secondary mt-2"
        >
          Seleccionar de la biblioteca
        </button>
        <ImageLibraryModal
          isOpen={libraryOpen}
          onClose={() => setLibraryOpen(false)}
          onSelect={(url) => setValues((current) => ({ ...current, prizeImageUrl: url }))}
        />
        {values.prizeImageUrl && (
          <p className="mt-2 break-all text-sm text-text-muted">
            Imagen actual: {values.prizeImageUrl}
          </p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="lottery-start" className="text-sm font-medium text-text-secondary">
            Inicio (hora de Madrid)
          </label>
          <input
            id="lottery-start"
            type="datetime-local"
            className={FIELD_CLASS}
            value={values.startDate}
            onChange={update('startDate')}
            required
            disabled={disabledAll || startLocked}
          />
        </div>
        <div>
          <label htmlFor="lottery-end" className="text-sm font-medium text-text-secondary">
            Fin (hora de Madrid)
          </label>
          <input id="lottery-end" type="datetime-local" className={FIELD_CLASS} value={values.endDate} onChange={update('endDate')} required disabled={disabledAll} />
        </div>
      </div>

      <div>
        <label htmlFor="lottery-minimum" className="text-sm font-medium text-text-secondary">
          Importe mínimo del pedido en EUR (opcional)
        </label>
        <input
          id="lottery-minimum"
          type="number"
          min="0"
          step="0.01"
          className={FIELD_CLASS}
          value={values.minimumOrderAmount}
          onChange={update('minimumOrderAmount')}
          disabled={disabledAll}
        />
      </div>

      {!readOnly && (
        <button type="submit" disabled={saving || uploading} className="btn btn-primary disabled:opacity-60">
          {saving ? 'Guardando...' : lotteryId ? 'Guardar cambios' : 'Crear sorteo'}
        </button>
      )}
    </form>
  );
}
