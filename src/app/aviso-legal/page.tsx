import { Navigation } from '@/components/Navigation';
import { Footer } from '@/components/Footer';

export const metadata = {
  title: 'Aviso Legal - TCG Iberia',
  description: 'Aviso Legal de TCG Iberia',
};

export default function AvisoLegalPage() {
  return (
    <>
      <Navigation />
      <main className="min-h-screen bg-dark-bg">
        <div className="container-custom px-4 py-12 md:py-16">
          <div className="max-w-3xl mx-auto">
            <h1 className="text-h2 mb-8 text-text-primary">Aviso Legal</h1>
            
            <div className="prose prose-invert max-w-none space-y-6">
              <section>
                <h2 className="text-h4 text-text-primary mb-4">Identificación</h2>
                <p className="text-text-secondary">
                  TCG Iberia es una tienda online dedicada a la venta de productos de trading card games, en particular Pokémon TCG.
                </p>
              </section>

              <section>
                <h2 className="text-h4 text-text-primary mb-4">Información Legal</h2>
                <ul className="list-disc list-inside space-y-2 text-text-secondary">
                  <li>Razón Social: TCG Iberia</li>
                  <li>Email: sales@tcgiberia.com</li>
                  <li>Teléfono: +34 689 178 762</li>
                </ul>
              </section>

              <section>
                <h2 className="text-h4 text-text-primary mb-4">Responsabilidad de Contenidos</h2>
                <p className="text-text-secondary">
                  TCG Iberia se esfuerza por mantener la precisión de la información en esta plataforma. Sin embargo, no asume responsabilidad por errores en la descripción de productos, precios u otros contenidos.
                </p>
              </section>

              <section>
                <h2 className="text-h4 text-text-primary mb-4">Propiedad Intelectual</h2>
                <p className="text-text-secondary">
                  Todo el contenido de esta plataforma, incluyendo textos, imágenes y logotipos, está protegido por derechos de autor y leyes de propiedad intelectual.
                </p>
              </section>

              <section>
                <h2 className="text-h4 text-text-primary mb-4">Disclaimers</h2>
                <p className="text-text-secondary">
                  TCG Iberia no es responsable por daños indirectos, incidentales o consecuentes derivados del uso de esta plataforma. Los productos se venden &quot;tal como están&quot; sin garantías adicionales.
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
