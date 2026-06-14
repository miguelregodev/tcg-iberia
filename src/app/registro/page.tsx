'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import * as Sentry from '@sentry/nextjs';
import { trackEvent } from '@/lib/analytics/events';

interface FormData {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
  phone: string;
  addressLine: string;
  postalCode: string;
  city: string;
  locality: string;
  province: string;
}

const INITIAL_FORM: FormData = {
  fullName: '',
  email: '',
  password: '',
  confirmPassword: '',
  phone: '',
  addressLine: '',
  postalCode: '',
  city: '',
  locality: '',
  province: '',
};

// Minimum 8 chars, at least one letter and one number
const PASSWORD_REGEX = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;

export default function RegistroPage() {
  const router = useRouter();
  const [formData, setFormData] = useState<FormData>(INITIAL_FORM);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Partial<FormData & { general: string }>>({});

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear field error on change
    if (errors[name as keyof typeof errors]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const validate = (): boolean => {
    const newErrors: Partial<FormData & { general: string }> = {};

    if (!formData.fullName.trim()) newErrors.fullName = 'El nombre completo es obligatorio.';
    if (!formData.email.trim()) {
      newErrors.email = 'El correo electrónico es obligatorio.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Introduce un correo electrónico válido.';
    }
    if (!formData.password) {
      newErrors.password = 'La contraseña es obligatoria.';
    } else if (!PASSWORD_REGEX.test(formData.password)) {
      newErrors.password = 'Mínimo 8 caracteres, con al menos una letra y un número.';
    }
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Las contraseñas no coinciden.';
    }
    if (!formData.phone.trim()) newErrors.phone = 'El teléfono es obligatorio.';
    if (!formData.addressLine.trim()) newErrors.addressLine = 'La dirección es obligatoria.';
    if (!formData.postalCode.trim()) newErrors.postalCode = 'El código postal es obligatorio.';
    if (!formData.city.trim()) newErrors.city = 'La ciudad es obligatoria.';
    if (!formData.locality.trim()) newErrors.locality = 'La localidad es obligatoria.';
    if (!formData.province.trim()) newErrors.province = 'La provincia es obligatoria.';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    setErrors({});

    try {
      const res = await fetch('/api/user/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: formData.fullName.trim(),
          email: formData.email.trim().toLowerCase(),
          password: formData.password,
          phone: formData.phone.trim(),
          addressLine: formData.addressLine.trim(),
          postalCode: formData.postalCode.trim(),
          city: formData.city.trim(),
          locality: formData.locality.trim(),
          province: formData.province.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrors({ general: data.error ?? 'Ha ocurrido un error al registrarte.' });
        return;
      }

      trackEvent('user_registered', { method: 'email' });

      // Auto sign-in after registration
      const signInResult = await signIn('credentials', {
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
        redirect: false,
      });

      if (signInResult?.error) {
        // Registration succeeded but sign-in failed; send to home
        router.push('/');
      } else {
        router.push('/mi-cuenta');
      }
    } catch (err) {
      Sentry.captureException(err, { tags: { module: 'auth', action: 'register' } });
      setErrors({ general: 'Ha ocurrido un error inesperado.' });
    } finally {
      setLoading(false);
    }
  };

  const field = (
    id: keyof FormData,
    label: string,
    type = 'text',
    autoComplete?: string,
  ) => (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">
        {label} <span className="text-red-600">*</span>
      </label>
      <input
        id={id}
        name={id}
        type={type}
        autoComplete={autoComplete}
        value={formData[id]}
        onChange={handleChange}
        disabled={loading}
        className={`w-full bg-gray-50 border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-1 transition-colors ${
          errors[id]
            ? 'border-red-400 focus:border-red-500 focus:ring-red-500'
            : 'border-gray-300 focus:border-red-500 focus:ring-red-500'
        }`}
      />
      {errors[id] && <p className="mt-1 text-xs text-red-600">{errors[id]}</p>}
    </div>
  );

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm py-4 px-4 flex justify-center items-center">
        <Link href="/" className="flex items-center gap-2">
          <img src="/images/logo.png" alt="TCG Iberia" className="h-10 w-auto" />
          <span className="text-lg md:text-2xl font-bold text-red-600">TCG Iberia</span>
        </Link>
      </header>

      <div className="section">
        <div className="container-custom max-w-2xl mx-auto">
          <h1 className="text-h2 text-center mb-2">Crear cuenta</h1>
          <p className="text-center text-gray-500 mb-8">
            Únete a TCG Iberia y empieza a coleccionar.
          </p>

          {errors.general && (
            <div className="mb-6 px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
              {errors.general}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            {/* Personal info */}
            <div className="card">
              <h2 className="text-lg font-semibold mb-4">Datos personales</h2>
              <div className="grid grid-cols-1 gap-4">
                {field('fullName', 'Nombre completo', 'text', 'name')}
                {field('email', 'Correo electrónico', 'email', 'email')}
                {field('password', 'Contraseña', 'password', 'new-password')}
                {field('confirmPassword', 'Confirmar contraseña', 'password', 'new-password')}
                {field('phone', 'Teléfono', 'tel', 'tel')}
              </div>
            </div>

            {/* Address */}
            <div className="card">
              <h2 className="text-lg font-semibold mb-4">Dirección de envío</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  {field('addressLine', 'Calle', 'text', 'street-address')}
                </div>
                {field('postalCode', 'Código Postal', 'text', 'postal-code')}
                {field('city', 'Ciudad', 'text', 'address-level2')}
                {field('locality', 'Localidad', 'text', 'address-level3')}
                {field('province', 'Provincia', 'text', 'address-level1')}
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full btn btn-primary disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? 'Creando cuenta...' : 'Crear cuenta'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            ¿Ya tienes cuenta?{' '}
            <Link href="/?login=1" className="text-red-600 hover:text-red-700 font-semibold">
              Acceder
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
