export function TrustSection() {
  const features = [
    {
      title: 'Authentic Pokemon Products',
      description: 'Every card verified and authenticated by certified professionals',
      icon: '✓',
    },
    {
      title: 'Fast Shipping',
      description: 'Secure packaging with less than 5 business day delivery across EU',
      icon: '🚚',
    },
    {
      title: 'Premium Support',
      description: '24/7 customer support via WhatsApp and email',
      icon: '💬',
    },
  ];

  return (
    <section id="contact" className="section bg-red-50">
      <div className="container-custom">
        <h2 className="text-h2 mb-12 text-center">Why TCG Iberia</h2>
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
              Chat on WhatsApp
            </a>
            <a
              href="mailto:sales@tcgiberia.com"
              className="btn btn-secondary"
            >
              Email Us
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}