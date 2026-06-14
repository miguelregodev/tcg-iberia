'use client';

import { useEffect, useState } from 'react';
import * as Sentry from '@sentry/nextjs';

interface ProfileData {
  fullName: string;
  email: string;
  phone: string;
  addressLine: string;
  postalCode: string;
  city: string;
  locality: string;
  province: string;
  country: string;
}

const INITIAL: ProfileData = {
  fullName: '',
  email: '',
  phone: '',
  addressLine: '',
  postalCode: '',
  city: '',
  locality: '',
  province: '',
  country: 'España',
};

export default function DatosPersonalesPage() {
  const [formData, setFormData] = useState<ProfileData>(INITIAL);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<ProfileData>>({});

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await fetch('/api/user/profile');
        if (!res.ok) throw new Error('Failed to load profile');
        const json = await res.json();
        const d = json.data;
        setFormData({
          fullName: d.fullName ?? '',
          email: d.email ?? '',
          phone: d.phone ?? '',
          addressLine: d.addressLine ?? '',
          postalCode: d.postalCode ?? '',
          city: d.city ?? '',
          locality: d.locality ?? '',
          province: d.province ?? '',
          country: d.country ?? 'España',
        });
      } catch (err) {
        Sentry.captureException(err, { tags: { module: 'mi-cuenta', section: 'datos-personales' } });
        setError('No se pudieron cargar tus datos.');
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (fieldErrors[name as keyof ProfileData]) {
      setFieldErrors((prev) => ({ ...prev, [name]: undefined }));
    }
    setSuccess(false);
  };

  const validate = (): boolean => {
    const errs: Partial<ProfileData> = {};
    if (!formData.fullName.trim()) errs.fullName = 'El nombre es obligatorio.';
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const res = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? 'Error al guardar los cambios.');
      } else {
        setSuccess(true);
      }
    } catch (err) {
      Sentry.captureException(err, { tags: { module: 'mi-cuenta', section: 'datos-personales' } });
      setError('Error inesperado. Inténtalo de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  const field = (
    id: keyof ProfileData,
    label: string,
    type = 'text',
    autoComplete?: string,
    readOnly = false,
  ) => (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        autoComplete={autoComplete}
        value={formData[id]}
        onChange={handleChange}
        disabled={saving || readOnly}
        readOnly={readOnly}
        className={`w-full rounded-lg px-4 py-2.5 text-sm transition-colors focus:outline-none focus:ring-1 ${
          readOnly
            ? 'bg-gray-100 border border-gray-200 text-gray-500 cursor-default'
            : fieldErrors[id]
            ? 'bg-gray-50 border border-red-400 focus:border-red-500 focus:ring-red-500'
            : 'bg-gray-50 border border-gray-300 focus:border-red-500 focus:ring-red-500'
        }`}
      />
      {fieldErrors[id] && <p className="mt-1 text-xs text-red-600">{fieldErrors[id]}</p>}
    </div>
  );

  if (loading) {
    return (
      <div className="card">
        <div className="animate-pulse space-y-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-10 bg-gray-100 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <h1 className="text-h3 mb-6">Datos Personales</h1>

      {error && (
        <div className="mb-5 px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-5 px-4 py-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">
          ✓ Datos actualizados correctamente.
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6" noValidate>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            {field('fullName', 'Nombre completo', 'text', 'name')}
          </div>
          {field('email', 'Correo electrónico', 'email', 'email', true)}
          {field('phone', 'Teléfono', 'tel', 'tel')}
          <div className="sm:col-span-2">
            {field('addressLine', 'Dirección', 'text', 'street-address')}
          </div>
          {field('postalCode', 'Código Postal', 'text', 'postal-code')}
          {field('city', 'Ciudad', 'text', 'address-level2')}
          {field('locality', 'Localidad', 'text', 'address-level3')}
          {field('province', 'Provincia', 'text', 'address-level1')}
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="btn btn-primary disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </form>
    </div>
  );
}
