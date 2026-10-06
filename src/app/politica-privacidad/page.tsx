import { Navigation } from '@/components/Navigation';
import { Footer } from '@/components/Footer';
import { buildPageMetadata } from '@/lib/seo/metadata';

export const metadata = buildPageMetadata({
  title: 'Política de Privacidad',
  description: 'Política de privacidad de TCG Iberia: qué datos personales tratamos, para qué y cómo ejercer tus derechos.',
  path: '/politica-privacidad',
});

export default function PoliticaPrivacidadPage() {
  return (
    <>
      <Navigation />
      <div className="min-h-screen bg-dark-bg">
        <div className="container-custom px-4 py-12 md:py-16">
          <div className="max-w-3xl mx-auto">
            <h1 className="text-h2 mb-8 text-text-primary">Política de Privacidad</h1>
            
            <div className="prose prose-invert max-w-none space-y-6">
              <section>
                <h2 className="text-h4 text-text-primary mb-4">Introducción</h2>
                <p className="text-text-secondary">
                  En TCG Iberia, valoramos tu privacidad. Esta política describe cómo recopilamos, utilizamos y protegemos tus datos personales.
                </p>
              </section>

              <section>
                <h2 className="text-h4 text-text-primary mb-4">Información que Recopilamos</h2>
                <p className="text-text-secondary mb-3">Recopilamos información personal como:</p>
                <ul className="list-disc list-inside space-y-2 text-text-secondary">
                  <li>Nombre y datos de contacto</li>
                  <li>Dirección de entrega</li>
                  <li>Información de pago</li>
                  <li>Historial de compras</li>
                  <li>Preferencias del usuario</li>
                </ul>
              </section>

              <section>
                <h2 className="text-h4 text-text-primary mb-4">Uso de la Información</h2>
                <p className="text-text-secondary">
                  Utilizamos tu información para procesar pedidos, mejorar nuestros servicios, y mantener la seguridad de nuestra plataforma. No vendemos tu información a terceros.
                </p>
              </section>

              <section>
                <h2 className="text-h4 text-text-primary mb-4">Protección de Datos</h2>
                <p className="text-text-secondary">
                  Implementamos medidas de seguridad para proteger tus datos personales contra acceso no autorizado, alteración, divulgación o destrucción.
                </p>
              </section>

              <section>
                <h2 className="text-h4 text-text-primary mb-4">Contacto</h2>
                <p className="text-text-secondary">
                  Si tienes preguntas sobre esta política, contacta con nosotros en sales@tcgiberia.com
                </p>
              </section>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
}
