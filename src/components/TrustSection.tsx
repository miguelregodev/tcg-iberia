export function TrustSection() {
  const features = [
    {
      title: 'Authentic Japanese Products',
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
    <section className="section bg-white">
      <div className="container-custom">
        <h2 className="text-h2 mb-12 text-center">Why TCG Iberia</h2>
        <div className="grid md:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <div key={index} className="text-center">
              <div className="text-5xl mb-4">{feature.icon}</div>
              <h3 className="text-h3 mb-3">{feature.title}</h3>
              <p className="text-gray-600">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}