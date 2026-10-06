import Link from 'next/link';
import { Navigation } from '@/components/Navigation';
import { Footer } from '@/components/Footer';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { GUIDES } from '@/lib/seo/guides';
import { buildPageMetadata } from '@/lib/seo/metadata';

export const metadata = buildPageMetadata({
  title: 'Guías de Pokémon TCG para coleccionistas',
  description:
    'Guías de Pokémon TCG: qué es una booster box, diferencias entre las ediciones japonesa, coreana y china, y cómo entender las rarezas de las cartas.',
  path: '/guias',
});

export default function GuiasPage() {
  return (
    <>
      <Navigation />
      <Breadcrumbs items={[{ label: 'Inicio', href: '/' }, { label: 'Guías' }]} />
      <div className="bg-dark-bg">
        <div className="container-custom px-4 py-12 md:py-16">
          <div className="max-w-3xl">
            <h1 className="text-h2 mb-4 text-text-primary">Guías de Pokémon TCG</h1>
            <p className="text-text-secondary mb-10 leading-relaxed">
              Explicaciones prácticas para entender los productos, las ediciones y las rarezas antes de comprar.
            </p>

            <ul className="space-y-6">
              {GUIDES.map((guide) => (
                <li key={guide.slug} className="rounded-card border border-dark-border bg-dark-surface p-6">
                  <h2 className="text-xl font-bold text-text-primary">
                    <Link
                      href={`/guias/${guide.slug}`}
                      className="hover:text-premium-gold transition-colors"
                    >
                      {guide.title}
                    </Link>
                  </h2>
                  <p className="mt-2 text-sm text-text-secondary leading-relaxed">{guide.description}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
}
