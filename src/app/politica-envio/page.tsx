import { Navigation } from '@/components/Navigation';
import { Footer } from '@/components/Footer';

export const metadata = {
  title: 'Política de Envío - TCG Iberia',
  description: 'Política de Envío de TCG Iberia',
};

export default function PoliticaEnvioPage() {
  return (
    <>
      <Navigation />
      <main className="min-h-screen bg-dark-bg">
        <div className="container-custom px-4 py-12 md:py-16">
          <div className="max-w-3xl mx-auto">
            <h1 className="text-h2 mb-8 text-text-primary">Política de Envío</h1>
            
            <div className="prose prose-invert max-w-none space-y-6">
              <section>
                <h2 className="text-h4 text-text-primary mb-4">Zonas de Envío</h2>
                <p className="text-text-secondary">
                  Enviamos a toda España continental, islas Baleares e islas Canarias. También realizamos envíos internacionales.
                </p>
              </section>

              <section>
                <h2 className="text-h4 text-text-primary mb-4">Costos de Envío</h2>
                <ul className="list-disc list-inside space-y-2 text-text-secondary">
                  <li>España continental: Desde €4.99</li>
                  <li>Islas Canarias: Desde €10.99</li>
                  <li>Envío gratis en compras superiores a €200</li>
                </ul>
              </section>

              <section>
                <h2 className="text-h4 text-text-primary mb-4">Plazos de Entrega</h2>
                <p className="text-text-secondary mb-3">Los plazos de entrega estimados son:</p>
                <ul className="list-disc list-inside space-y-2 text-text-secondary">
                  <li>España continental: 2-3 días hábiles</li>
                  <li>Islas: 3-5 días hábiles</li>
                </ul>
              </section>

              <section>
                <h2 className="text-h4 text-text-primary mb-4">Seguimiento de Pedido</h2>
                <p className="text-text-secondary">
                  Recibirás un número de seguimiento por email una vez que tu pedido sea enviado. Podrás rastrear tu paquete en el sitio del transportista.
                </p>
              </section>

              <section>
                <h2 className="text-h4 text-text-primary mb-4">Problemas en el Envío</h2>
                <p className="text-text-secondary">
                  Si tu paquete no llega en el plazo estimado o llega dañado, contacta con nosotros inmediatamente en sales@tcgiberia.com
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
