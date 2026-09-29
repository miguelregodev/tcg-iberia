import { Navigation } from '@/components/Navigation';
import { Footer } from '@/components/Footer';

export const metadata = {
  title: 'Política de Cancelación - TCG Iberia',
  description: 'Política de Cancelación de TCG Iberia',
};

export default function PoliticaCancelacionPage() {
  return (
    <>
      <Navigation />
      <main className="min-h-screen bg-dark-bg">
        <div className="container-custom px-4 py-12 md:py-16">
          <div className="max-w-3xl mx-auto">
            <h1 className="text-h2 mb-8 text-text-primary">Política de Cancelación</h1>
            
            <div className="prose prose-invert max-w-none space-y-6">
              <section>
                <h2 className="text-h4 text-text-primary mb-4">Derecho de Cancelación</h2>
                <p className="text-text-secondary">
                  Tienes derecho a cancelar tu pedido dentro de 14 días desde la compra, sin necesidad de justificación, aunque se aplicarán los gastos de devolución.
                </p>
              </section>

              <section>
                <h2 className="text-h4 text-text-primary mb-4">Proceso de Cancelación</h2>
                <p className="text-text-secondary mb-3">Para cancelar tu pedido:</p>
                <ul className="list-disc list-inside space-y-2 text-text-secondary">
                  <li>Contacta con nosotros en sales@tcgiberia.com con tu número de pedido</li>
                  <li>Especifica la razón de la cancelación</li>
                  <li>Recibirás instrucciones para devolver el producto</li>
                  <li>Una vez recibida la devolución, procesaremos el reembolso</li>
                </ul>
              </section>

              <section>
                <h2 className="text-h4 text-text-primary mb-4">Excepciones</h2>
                <p className="text-text-secondary mb-3">No aplica derecho de cancelación en:</p>
                <ul className="list-disc list-inside space-y-2 text-text-secondary">
                  <li>Productos personalizados</li>
                  <li>Artículos bajo pedido</li>
                  <li>Productos ya enviados y recibidos que han sido abiertos</li>
                  <li>Artículos que muestran signos de uso</li>
                </ul>
              </section>

              <section>
                <h2 className="text-h4 text-text-primary mb-4">Cancelación de Pedidos No Enviados</h2>
                <p className="text-text-secondary">
                  Si tu pedido no ha sido enviado aún, podemos cancelarlo sin cargos. Contacta con nosotros inmediatamente.
                </p>
              </section>

              <section>
                <h2 className="text-h4 text-text-primary mb-4">Gastos de Cancelación</h2>
                <p className="text-text-secondary">
                  Los gastos de devolución corren por cuenta del cliente. El reembolso se realizará sin estos costes.
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
