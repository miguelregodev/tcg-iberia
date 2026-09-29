export function Featured() {
  return (
    <section className="relative overflow-hidden bg-dark-bgSecondary text-text-primary border-b border-dark-border">
      {/* Radial glow overlays */}
      <div
        className="absolute inset-0 opacity-40 pointer-events-none"
        style={{
          backgroundImage:
            'radial-gradient(circle at 20% 20%, rgba(245,231,122,0.10) 0%, transparent 60%), radial-gradient(circle at 80% 80%, rgba(245,231,122,0.08) 0%, transparent 60%)',
        }}
      />

      <div className="container-custom px-4 relative z-10 py-8 md:py-12">
        <span className="inline-block bg-premium-gold/10 backdrop-blur-sm border border-premium-gold/20 text-premium-gold rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider mb-3">
          Selección del equipo
        </span>
        <h1 className="font-bold text-3xl md:text-5xl lg:text-6xl tracking-tight leading-tight">
          Destacados
        </h1>
        <p className="mt-2 text-text-secondary text-sm md:text-base max-w-2xl">
          Nuestras recomendaciones imprescindibles para coleccionistas.
        </p>
      </div>
    </section>
  );
}