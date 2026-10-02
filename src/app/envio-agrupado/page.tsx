import { Navigation } from '@/components/Navigation';
import { Footer } from '@/components/Footer';

export const metadata = {
  title: 'Envío Agrupado - TCG Iberia',
  description: 'Cómo funciona el envío agrupado en TCG Iberia',
};

export default function EnvioAgrupadoPage() {
  return (
    <>
      <Navigation />
      <main className="min-h-screen bg-dark-bg">
        <div className="container-custom px-4 py-12 md:py-16">
          <div className="max-w-3xl mx-auto">
            <h1 className="text-h2 mb-8 text-text-primary">Envío Agrupado</h1>

            <div className="prose prose-invert max-w-none space-y-6">
              <section>
                <h2 className="text-h4 text-text-primary mb-4">¿Qué es el envío agrupado?</h2>
                <p className="text-text-secondary">
                  El envío agrupado te permite combinar varios pedidos en un único envío. En lugar de
                  pagar los gastos de envío de cada pedido por separado, puedes esperar a realizar
                  más compras y recibirlas todas juntas en un solo paquete, pagando un único gasto de
                  envío calculado sobre el valor total de la mercancía agrupada.
                </p>
              </section>

              <section>
                <h2 className="text-h4 text-text-primary mb-4">¿Cómo funciona?</h2>
                <ul className="list-disc list-inside space-y-2 text-text-secondary">
                  <li>
                    Al finalizar tu compra, selecciona la opción <strong>&quot;Agrupar envío&quot;</strong> en
                    lugar del envío inmediato.
                  </li>
                  <li>
                    Tu pedido quedará pendiente de envío y no se te cobrará el gasto de envío en ese
                    momento.
                  </li>
                  <li>
                    Puedes seguir comprando y marcar más pedidos para agrupar, siempre que se envíen a
                    la misma dirección.
                  </li>
                  <li>
                    Cuando quieras recibir tus pedidos, entra en{' '}
                    <strong>Mi Cuenta &gt; Mis Pedidos</strong> y pulsa <strong>&quot;Solicitar envío&quot;</strong>.
                    En ese momento se calcula un único gasto de envío para todos los pedidos
                    seleccionados.
                  </li>
                  <li>
                    Si el valor combinado de la mercancía supera el importe mínimo para envío gratuito,
                    no se cobrará ningún gasto de envío adicional.
                  </li>
                </ul>
              </section>

              <section>
                <h2 className="text-h4 text-text-primary mb-4">Ventajas</h2>
                <ul className="list-disc list-inside space-y-2 text-text-secondary">
                  <li>Ahorra en gastos de envío al combinar varios pedidos en uno solo.</li>
                  <li>
                    Más fácil alcanzar el envío gratuito al sumar el valor de varios pedidos.
                  </li>
                  <li>Tú decides cuándo recibir tus pedidos agrupados.</li>
                </ul>
              </section>

              <section>
                <h2 className="text-h4 text-text-primary mb-4">Tenlo en cuenta</h2>
                <p className="text-text-secondary">
                  Los pedidos agrupados solo pueden combinarse si comparten la misma dirección de
                  envío. El plazo de entrega estimado (2-3 días hábiles) se aplica a partir del momento
                  en que solicitas el envío, no desde la fecha de compra.
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
