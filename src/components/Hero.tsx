export function Hero() {
  return (
    <section className="relative w-full h-[60vh] md:h-[70vh] min-h-[440px] max-h-[820px] overflow-hidden bg-dark-bgSecondary border-b border-dark-border">
      <img
        src="/images/pikachu-4-scaled.jpg"
        alt="Colección Pokémon TCG de TCG Iberia"
        className="absolute inset-0 w-full h-full object-cover object-center"
      />
      {/* Gradient scrim so the headline stays legible over the photo */}
      <div className="absolute inset-0 bg-gradient-to-t from-dark-bg via-dark-bg/30 to-transparent" />

      <div className="relative z-10 h-full flex flex-col items-center justify-center text-center px-4 pb-12 md:pb-20">
        <span className="inline-block bg-premium-gold/10 backdrop-blur-sm border border-premium-gold/20 text-premium-gold rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider mb-4">
          TCG Iberia
        </span>
        <h1 className="font-bold text-3xl sm:text-4xl md:text-6xl tracking-tight leading-tight text-text-primary max-w-3xl">
          Pokémon TCG, de todo el mundo
        </h1>
        <p className="mt-3 text-white text-sm md:text-lg max-w-xl">
          Productos japoneses, coreanos e internacionales, seleccionados para coleccionistas.
        </p>
        <a href="#shop-by-category" className="btn btn-primary mt-6">
          Explorar colección
        </a>
      </div>
    </section>
  );
}
