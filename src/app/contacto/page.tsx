import { Navigation } from '@/components/Navigation';
import { Footer } from '@/components/Footer';

export const metadata = {
  title: 'Información de Contacto - TCG Iberia',
  description: 'Información de Contacto de TCG Iberia',
};

export default function ContactoPage() {
  return (
    <>
      <Navigation />
      <main className="min-h-screen bg-dark-bg">
        <div className="container-custom px-4 py-12 md:py-16">
          <div className="max-w-3xl mx-auto">
            <h1 className="text-h2 mb-8 text-text-primary">Información de Contacto</h1>
            
            <div className="prose prose-invert max-w-none space-y-6">
              <section>
                <h2 className="text-h4 text-text-primary mb-4">Contáctanos</h2>
                <p className="text-text-secondary">
                  Estamos aquí para ayudarte. Puedes contactarnos a través de los siguientes canales:
                </p>
              </section>

              <section>
                <h2 className="text-h4 text-text-primary mb-4">Email</h2>
                <p className="text-text-secondary">
                  <a href="mailto:sales@tcgiberia.com" className="text-premium-gold hover:text-premium-gold/80 transition-colors">
                    sales@tcgiberia.com
                  </a>
                </p>
              </section>

              <section>
                <h2 className="text-h4 text-text-primary mb-4">WhatsApp</h2>
                <p className="text-text-secondary">
                  <a href="https://wa.me/34689178762" className="text-premium-gold hover:text-premium-gold/80 transition-colors">
                    +34 689 178 762
                  </a>
                </p>
              </section>

              <section>
                <h2 className="text-h4 text-text-primary mb-4">Horario de Atención</h2>
                <ul className="list-disc list-inside space-y-2 text-text-secondary">
                  <li>Lunes a viernes: 9:00 - 23:59</li>
                  <li>Sábado: 10:00 - 20:00</li>
                  <li>Domingo: 12:00 - 23:59</li>
                </ul>
              </section>

              <section>
                <h2 className="text-h4 text-text-primary mb-4">Tiempo de Respuesta</h2>
                <p className="text-text-secondary">
                  Nos esforzamos en responder a todos los mensajes en un plazo de 24 horas.
                </p>
              </section>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
