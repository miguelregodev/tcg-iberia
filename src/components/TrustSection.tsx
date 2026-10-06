export function TrustSection() {
  const features = [
    {
      title: 'Productos Auténticos Verificados',
      description:
        'Cada producto es verificado para garantizar su autenticidad.',
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
      className="bg-dark-bgSecondary text-text-primary border-b border-dark-border"
    >
      <div className="container-custom px-4 py-16 md:py-24">
        {/* Header */}
        <div className="text-center mb-12 md:mb-16">
          <h2 className="font-bold text-2xl md:text-4xl tracking-tight text-text-primary">
            ¿Por qué TCG Iberia?
          </h2>
          <p className="mt-3 text-text-secondary text-sm md:text-base max-w-xl mx-auto">
            Calidad garantizada, envío de confianza y soporte cercano para todos
            los coleccionistas.
          </p>
        </div>

        {/* Feature columns, separated by subtle dividers instead of boxed cards */}
        <div className="grid md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-dark-border mb-12 md:mb-16">
          {features.map((feature, index) => (
            <div key={index} className="text-center px-4 py-8 md:py-0">
              <div className="text-3xl md:text-4xl mb-3">{feature.icon}</div>
              <h3 className="text-base md:text-lg font-semibold mb-2 text-text-primary">
                {feature.title}
              </h3>
              <p className="text-sm text-text-secondary leading-relaxed max-w-xs mx-auto">
                {feature.description}
              </p>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="border-t border-dark-border pt-8 md:pt-10 text-center">
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
            <a
              href="https://wa.me/34689178762"
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-primary"
            >
              Chatea en WhatsApp
            </a>
            <a
              href="mailto:sales@tcgiberia.com"
              className="btn btn-secondary"
            >
              Envíanos un email
            </a>
            <a
              href="https://chat.whatsapp.com/J5H9HSmPe70L2M3jMStnWW"
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary"
            >
              Nuestra Comunidad
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
