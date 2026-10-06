import { Navigation } from '@/components/Navigation';
import { Footer } from '@/components/Footer';
import { buildPageMetadata } from '@/lib/seo/metadata';

export const metadata = buildPageMetadata({
  title: 'Preferencias de Cookies',
  description: 'Información sobre las cookies que usa TCG Iberia y cómo gestionar tus preferencias.',
  path: '/preferencias-cookies',
});

export default function PreferenciasCookiesPage() {
  return (
    <>
      <Navigation />
      <div className="min-h-screen bg-dark-bg">
        <div className="container-custom px-4 py-12 md:py-16">
          <div className="max-w-3xl mx-auto">
            <h1 className="text-h2 mb-8 text-text-primary">Preferencias de Cookies</h1>
            
            <div className="prose prose-invert max-w-none space-y-6">
              <section>
                <h2 className="text-h4 text-text-primary mb-4">¿Qué son las Cookies?</h2>
                <p className="text-text-secondary">
                  Las cookies son pequeños archivos de texto que se almacenan en tu dispositivo cuando visitas un sitio web. Nos ayudan a mejorar tu experiencia de navegación.
                </p>
              </section>

              <section>
                <h2 className="text-h4 text-text-primary mb-4">Tipos de Cookies</h2>
                <ul className="list-disc list-inside space-y-2 text-text-secondary">
                  <li><strong>Cookies Esenciales:</strong> Necesarias para el funcionamiento básico del sitio</li>
                  <li><strong>Cookies de Análisis:</strong> Nos ayudan a entender cómo usas el sitio</li>
                  <li><strong>Cookies de Marketing:</strong> Utilizadas para mostrarte contenido personalizado</li>
                  <li><strong>Cookies de Preferencias:</strong> Guardan tus preferencias de usuario</li>
                </ul>
              </section>

              <section>
                <h2 className="text-h4 text-text-primary mb-4">Cómo Gestionar Cookies</h2>
                <p className="text-text-secondary mb-3">Puedes gestionar tus preferencias de cookies de las siguientes formas:</p>
                <ul className="list-disc list-inside space-y-2 text-text-secondary">
                  <li>Usar el panel de consentimiento en la plataforma</li>
                  <li>Ajustar la configuración de privacidad de tu navegador</li>
                  <li>Limpiar las cookies de tu dispositivo</li>
                </ul>
              </section>

              <section>
                <h2 className="text-h4 text-text-primary mb-4">Cookies de Terceros</h2>
                <p className="text-text-secondary">
                  Utilizamos servicios de terceros como Google Analytics y redes de publicidad que pueden establecer cookies en tu dispositivo. Puedes desactivarlas desde tu navegador.
                </p>
              </section>

              <section>
                <h2 className="text-h4 text-text-primary mb-4">Consentimiento</h2>
                <p className="text-text-secondary">
                  Al continuar navegando en nuestro sitio, aceptas el uso de cookies de acuerdo con esta política. Puedes cambiar tu consentimiento en cualquier momento.
                </p>
              </section>

              <section>
                <h2 className="text-h4 text-text-primary mb-4">Contacto</h2>
                <p className="text-text-secondary">
                  Si tienes preguntas sobre nuestro uso de cookies, contacta con sales@tcgiberia.com
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
