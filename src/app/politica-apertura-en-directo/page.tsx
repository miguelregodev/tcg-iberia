import { Navigation } from '@/components/Navigation';
import { Footer } from '@/components/Footer';
import { buildPageMetadata } from '@/lib/seo/metadata';

export const metadata = buildPageMetadata({
  title: 'Condiciones de Apertura en Directo',
  description:
    'Condiciones de la opción "Apertura en Directo": el producto se abre durante un LIVE de TikTok o Twitch, nunca se envía precintado y no admite devoluciones.',
  path: '/politica-apertura-en-directo',
});

export default function PoliticaAperturaEnDirectoPage() {
  return (
    <>
      <Navigation />
      <div className="min-h-screen bg-dark-bg">
        <div className="container-custom px-4 py-12 md:py-16">
          <div className="max-w-3xl mx-auto">
            <h1 className="text-h2 mb-8 text-text-primary">Condiciones de &quot;Apertura en Directo&quot;</h1>

            <div className="prose prose-invert max-w-none space-y-6">
              <section>
                <h2 className="text-h4 text-text-primary mb-4">¿Qué es &quot;Apertura en Directo&quot;?</h2>
                <p className="text-text-secondary">
                  &quot;Apertura en Directo&quot; es una opción de compra que te permite adquirir un producto
                  precintado con la condición específica de que será abierto por TCG Iberia durante uno
                  de nuestros LIVE de TikTok o Twitch, en lugar de recibirlo precintado en tu domicilio. Es una
                  alternativa a la opción &quot;Sellado&quot;, pensada para quienes quieren vivir la apertura
                  de su producto en directo junto a la comunidad beneficiándose de un precio más económico.
                </p>
              </section>

              <section>
                <h2 className="text-h4 text-text-primary mb-4">¿Cuándo se abrirá el producto?</h2>
                <ul className="list-disc list-inside space-y-2 text-text-secondary">
                    <li>
                    Nuestro horario de LIVE de TikTok y Twitch es de Domingo a Viernes de 21:30 a 00:00 aproximadamente. 
                    El momento exacto de la apertura dependerá de la cola de aperturas de productos en espera.
                  </li>
                  <li>
                    Si hay un LIVE en curso en el momento de tu compra, tu producto se abrirá durante
                    ese mismo LIVE.
                  </li>
                  <li>
                    Si no hay ningún LIVE en curso, tu producto se abrirá durante el próximo LIVE que
                    realicemos.
                  </li>
                  <li>
                    Nos aseguraremos de que estás presente en el LIVE <b>antes</b> de realizar la apertura. En caso de no estarlo, esperaremos a que te unas al próximo LIVE disponible. Si tampoco estás presente en el siguiente LIVE, la apertura se realizará sin tu participación y se te enviarán los productos abiertos a tu domicilio.
                  </li>
                </ul>
              </section>

              <section>
                <h2 className="text-h4 text-text-primary mb-4">El producto nunca se envía precintado</h2>
                <p className="text-text-secondary">
                  Al seleccionar &quot;Apertura en Directo&quot;, aceptas que el producto se abrirá durante un
                  LIVE de TikTok y que, por tanto, <strong>nunca se enviará como producto precintado</strong>.
                  Esto es distinto de la opción &quot;Sellado&quot;, en la que el producto se envía a tu domicilio
                  precintado y sin abrir. Si no quieres que tu producto se abra durante un LIVE, selecciona
                  &quot;Sellado&quot; en la página del producto.
                </p>
              </section>

              <section>
                <h2 className="text-h4 text-text-primary mb-4">Devoluciones</h2>
                <p className="text-text-secondary">
                  Los productos comprados con la opción &quot;Apertura en Directo&quot; <strong>no admiten
                  devolución</strong>, ya que se abren durante el LIVE. Al seleccionar esta opción, aceptas
                  esta condición como parte de la compra.
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
