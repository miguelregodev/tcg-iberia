import Link from 'next/link';
import type { Metadata } from 'next';
import { Navigation } from '@/components/Navigation';
import { Footer } from '@/components/Footer';
import { noIndexMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = noIndexMetadata('Página no encontrada');

export default function NotFound() {
  return (
    <>
      <Navigation />
      <div className="min-h-[60vh] bg-dark-bg flex items-center justify-center px-4 py-16">
        <div className="text-center max-w-xl">
          <p className="text-sm font-semibold uppercase tracking-wider text-premium-gold mb-2">Error 404</p>
          <h1 className="text-2xl md:text-3xl font-bold text-text-primary mb-3">Página no encontrada</h1>
          <p className="text-text-secondary mb-8">
            La página que buscas no existe o el producto ya no está disponible. Prueba con nuestras categorías
            principales.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link href="/" className="btn btn-primary">
              Ir al inicio
            </Link>
            <Link href="/booster-boxes" className="btn btn-secondary">
              Booster boxes
            </Link>
            <Link href="/booster-packs" className="btn btn-secondary">
              Sobres
            </Link>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
}
