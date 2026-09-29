import { Navigation } from '@/components/Navigation';
import { Footer } from '@/components/Footer';

export const metadata = {
  title: 'Términos del Servicio - TCG Iberia',
  description: 'Términos del Servicio de TCG Iberia',
};

export default function TerminosServicioPage() {
  return (
    <>
      <Navigation />
      <main className="min-h-screen bg-dark-bg">
        <div className="container-custom px-4 py-12 md:py-16">
          <div className="max-w-3xl mx-auto">
            <h1 className="text-h2 mb-8 text-text-primary">Términos del Servicio</h1>
            
            <div className="prose prose-invert max-w-none space-y-6">
              <section>
                <h2 className="text-h4 text-text-primary mb-4">Aceptación de Términos</h2>
                <p className="text-text-secondary">
                  Al acceder y utilizar esta plataforma, aceptas estar sujeto a estos términos y condiciones.
                </p>
              </section>

              <section>
                <h2 className="text-h4 text-text-primary mb-4">Uso de la Plataforma</h2>
                <p className="text-text-secondary mb-3">Aceptas usar esta plataforma solo para propósitos legítimos y no:</p>
                <ul className="list-disc list-inside space-y-2 text-text-secondary">
                  <li>Violar leyes o regulaciones aplicables</li>
                  <li>Infringir derechos de terceros</li>
                  <li>Utilizar software malicioso</li>
                  <li>Interferir con la operación de la plataforma</li>
                  <li>Realizar actividades fraudulentas</li>
                </ul>
              </section>

              <section>
                <h2 className="text-h4 text-text-primary mb-4">Limitación de Responsabilidad</h2>
                <p className="text-text-secondary">
                  TCG Iberia no es responsable de daños directos, indirectos, incidentales o consecuentes que resulten del uso de nuestra plataforma.
                </p>
              </section>

              <section>
                <h2 className="text-h4 text-text-primary mb-4">Cambios en los Términos</h2>
                <p className="text-text-secondary">
                  Nos reservamos el derecho de modificar estos términos en cualquier momento. Los cambios serán efectivos inmediatamente tras su publicación.
                </p>
              </section>

              <section>
                <h2 className="text-h4 text-text-primary mb-4">Contacto</h2>
                <p className="text-text-secondary">
                  Para preguntas sobre estos términos, contacta con sales@tcgiberia.com
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
