import Link from 'next/link';

const ORIGINS = [
  {
    href: '/pokemon-tcg-japones',
    flag: '/images/japan.png',
    title: 'Pokémon TCG japonés',
    text: 'Booster boxes, sobres y productos de la edición original de Japón, con sus ilustraciones especiales.',
  },
  {
    href: '/pokemon-tcg-coreano',
    flag: '/images/south-korea.png',
    title: 'Pokémon TCG coreano',
    text: 'Productos de la edición de Corea del Sur, con su propio calendario de lanzamientos.',
  },
  {
    href: '/etbs',
    flag: '/images/united-kingdom.png',
    title: 'Inglés y español',
    text: 'Elite Trainer Boxes, bundles y sobres de las ediciones occidentales para jugar y coleccionar.',
  },
];

/** Homepage block that explains what the store sells and links to the language/origin hubs. */
export function HomeIntro() {
  return (
    <section className="bg-dark-bgSecondary border-y border-dark-border" aria-labelledby="home-origin-heading">
      <div className="container-custom px-4 py-16 md:py-20">
        <div className="max-w-3xl mb-10">
          <h2 id="home-origin-heading" className="font-bold text-2xl md:text-4xl tracking-tight text-text-primary">
            Cartas Pokémon de Japón, Corea y el resto del mundo
          </h2>
          <p className="mt-3 text-text-secondary leading-relaxed">
            TCG Iberia es una tienda online de Pokémon TCG con envío a toda España. Elige la edición que
            coleccionas: cada producto indica su idioma, su formato y su disponibilidad real.
          </p>
        </div>

        <ul className="grid gap-4 md:grid-cols-3">
          {ORIGINS.map((origin) => (
            <li key={origin.href}>
              <Link
                href={origin.href}
                className="block h-full rounded-card border border-dark-border bg-dark-surface p-6 transition-colors hover:border-premium-gold/50"
              >
                <h3 className="flex items-center gap-3 text-lg font-semibold text-text-primary">
                  <img src={origin.flag} alt="" width={28} height={20} className="w-7 h-5 object-cover rounded-sm" loading="lazy" />
                  {origin.title}
                </h3>
                <p className="mt-2 text-sm text-text-secondary leading-relaxed">{origin.text}</p>
              </Link>
            </li>
          ))}
        </ul>

        <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <Link href="/distribuidor-tcg-espana" className="text-premium-gold hover:underline underline-offset-4">
            Soy una tienda o profesional: cuenta B2B
          </Link>
          <Link href="/guias" className="text-premium-gold hover:underline underline-offset-4">
            Guías para empezar a coleccionar
          </Link>
          <Link href="/politica-envio" className="text-premium-gold hover:underline underline-offset-4">
            Información de envío
          </Link>
        </div>
      </div>
    </section>
  );
}
