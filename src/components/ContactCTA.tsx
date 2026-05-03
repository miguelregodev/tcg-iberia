export function ContactCTA() {
  return (
    <section id="contact" className="section bg-red-50">
      <div className="container-custom text-center">
        <h2 className="text-h2 mb-6">Ready to Collect?</h2>
        <p className="text-gray-600 text-lg mb-8 max-w-2xl mx-auto">
          Contact us for special requests, bulk orders, or to discuss rare finds.
        </p>
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
    </section>
  );
}