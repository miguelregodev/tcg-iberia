export function TrustSection() {
  const features = [
    {
      title: 'Productos Auténticos Verificados',
      description:
        'Cada carta verificada y autenticada por profesionales certificados.',
      icon: '✓',
    },
    {
      title: 'Envío Rápido',
      description:
        'Envíos rápidos y seguros a toda España con seguimiento en tiempo real.',
      icon: '🚚',
    },
    {
      title: 'Soporte Premium',
      description:
        'Atención al cliente 24/7 a través de WhatsApp y correo electrónico.',
      icon: '💬',
    },
  ];

  return (
    <section
      id="contact"
      className="relative overflow-hidden bg-gradient-to-br from-gray-900 via-red-900 to-black text-white"
    >
      {/* Radial glow overlays — same recipe as Hit Cards hero */}
      <div
        className="absolute inset-0 opacity-20 pointer-events-none"
        style={{
          backgroundImage:
            'radial-gradient(circle at 20% 20%, rgba(255,255,255,0.15) 0%, transparent 60%), radial-gradient(circle at 80% 80%, rgba(220,38,38,0.4) 0%, transparent 60%)',
        }}
      />

      <div className="container-custom px-4 relative z-10 py-12 md:py-20">
        {/* Header */}
        <div className="text-center mb-10 md:mb-14">
          <h2 className="font-airstrike text-3xl md:text-5xl lg:text-6xl tracking-wider leading-tight">
            ¿por que tcg iberia?
          </h2>
          <p className="mt-3 text-gray-300 text-base md:text-lg max-w-2xl mx-auto">
            Calidad garantizada, envío de confianza y soporte cercano para todos
            los coleccionistas.
          </p>
        </div>

        {/* Feature cards */}
        <div className="grid md:grid-cols-3 gap-4 md:gap-6 mb-10 md:mb-14">
          {features.map((feature, index) => (
            <div
              key={index}
              className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl px-6 py-7 text-center hover:bg-white/15 hover:border-white/30 transition-colors"
            >
              <div className="text-4xl md:text-5xl mb-3">{feature.icon}</div>
              <h3 className="text-lg md:text-xl font-bold mb-2">
                {feature.title}
              </h3>
              <p className="text-sm text-gray-300 leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="border-t border-white/15 pt-8 md:pt-10 text-center">
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
            <a
              href="https://wa.me/34689178762"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 bg-white text-red-700 hover:bg-gray-100 px-6 py-3 rounded-lg font-semibold transition-all hover:shadow-lg"
            >
              Chatea en WhatsApp
            </a>
            <a
              href="mailto:sales@tcgiberia.com"
              className="inline-flex items-center justify-center gap-2 bg-white/10 backdrop-blur-sm border border-white/30 text-white hover:bg-white/20 px-6 py-3 rounded-lg font-semibold transition-all"
            >
              Envíanos un email
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
