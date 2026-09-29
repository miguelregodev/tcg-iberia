import Link from 'next/link';

export function Preorders() {
  return (
    <section className="relative overflow-hidden bg-dark-bgSecondary text-text-primary border-b border-dark-border">
      <div
        className="absolute inset-0 opacity-40 pointer-events-none"
        style={{
          backgroundImage:
            'radial-gradient(circle at 20% 20%, rgba(245,231,122,0.10) 0%, transparent 60%), radial-gradient(circle at 80% 80%, rgba(245,231,122,0.08) 0%, transparent 60%)',
        }}
      />

      <div className="container-custom px-4 relative z-10 py-8 md:py-12">
        <span className="inline-block bg-premium-gold/10 backdrop-blur-sm border border-premium-gold/20 text-premium-gold rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider mb-3">
          Próximos lanzamientos
        </span>
        <h1 className="font-airstrike text-3xl md:text-5xl lg:text-6xl tracking-wider leading-tight">
          reserva ya
        </h1>
        <p className="mt-2 text-text-secondary text-sm md:text-base max-w-2xl">
          Descubre los próximos productos disponibles para reservar antes de su lanzamiento.
        </p>
        <Link
          href="/releases-calendar"
          className="inline-flex items-center gap-2 mt-4 text-sm font-semibold text-text-secondary hover:text-premium-gold transition-colors underline-offset-4 hover:underline"
        >
          <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path fillRule="evenodd" d="M5.75 2a.75.75 0 01.75.75V4h7V2.75a.75.75 0 011.5 0V4h.25A2.75 2.75 0 0118 6.75v8.5A2.75 2.75 0 0115.25 18H4.75A2.75 2.75 0 012 15.25v-8.5A2.75 2.75 0 014.75 4H5V2.75A.75.75 0 015.75 2zm-1 5.5c-.69 0-1.25.56-1.25 1.25v6.5c0 .69.56 1.25 1.25 1.25h10.5c.69 0 1.25-.56 1.25-1.25v-6.5c0-.69-.56-1.25-1.25-1.25H4.75z" clipRule="evenodd" />
          </svg>
          Ver calendario de lanzamientos
        </Link>
      </div>
    </section>
  );
}