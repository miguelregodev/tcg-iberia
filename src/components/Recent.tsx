export function Recent() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-gray-900 via-red-900 to-black text-white">
      {/* Radial glow overlays — same recipe as Hit Cards hero */}
      <div
        className="absolute inset-0 opacity-20 pointer-events-none"
        style={{
          backgroundImage:
            'radial-gradient(circle at 20% 20%, rgba(255,255,255,0.15) 0%, transparent 60%), radial-gradient(circle at 80% 80%, rgba(220,38,38,0.4) 0%, transparent 60%)',
        }}
      />

      <div className="container-custom px-4 relative z-10 py-8 md:py-12">
        <span className="inline-block bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider mb-3">
          Recién llegado
        </span>
        <h1 className="font-airstrike text-3xl md:text-5xl lg:text-6xl uppercase tracking-wider leading-tight">
          Últimas Novedades
        </h1>
        <p className="mt-2 text-gray-300 text-sm md:text-base max-w-2xl">
          Descubre los últimos productos añadidos al catálogo.
        </p>
      </div>
    </section>
  );
}