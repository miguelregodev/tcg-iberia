export function TrustSection() {
  const features = [
    {
      title: 'Productos Auténticos Verificados',
      description: 'Every card verified and authenticated by certified professionals',
      icon: '✓',
    },
    {
      title: 'Envío Rápido',
      description: 'Envíos rápidos y seguros a toda España con seguimiento en tiempo real',
      icon: '🚚',
    },
    {
      title: 'Soporte Premium',
      description: 'Soporte al cliente 24/7 a través de WhatsApp y correo electrónico',
      icon: '💬',
    },
  ];

  return (
    <section id="contact" className="section bg-red-50">
      <div className="container-custom">
        <h2 className="text-h2 mb-12 text-center">¿Por qué TCG Iberia?</h2>
        <div className="grid md:grid-cols-3 gap-8 mb-12">
          {features.map((feature, index) => (
            <div key={index} className="text-center">
              <div className="text-5xl mb-4">{feature.icon}</div>
              <h3 className="text-h3 mb-3">{feature.title}</h3>
              <p className="text-gray-600">{feature.description}</p>
            </div>
          ))}
        </div>
        
        <div className="border-t border-red-200 pt-12 text-center">
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
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
              Envíanos un Email
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}