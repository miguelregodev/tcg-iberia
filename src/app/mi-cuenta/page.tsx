import { redirect } from 'next/navigation';

// Default /mi-cuenta → redirect to datos-personales
export default function MiCuentaPage() {
  redirect('/mi-cuenta/datos-personales');
}
