import { Navigation } from '@/components/Navigation';
import { Footer } from '@/components/Footer';
import { buildPageMetadata } from '@/lib/seo/metadata';

export const metadata = buildPageMetadata({
  title: 'Política de Reembolso',
  description: 'Política de reembolso de TCG Iberia: cuándo puedes solicitar un reembolso y cómo gestionar productos dañados o defectuosos.',
  path: '/politica-reembolso',
});

export default function PoliticaReembolsoPage() {
  return (
    <>
      <Navigation />
      <div className="min-h-screen bg-dark-bg">
        <div className="container-custom px-4 py-12 md:py-16">
          <div className="max-w-3xl mx-auto">
            <h1 className="text-h2 mb-8 text-text-primary">Política de Reembolso de TCG Iberia</h1>
            
            <div className="prose prose-invert max-w-none space-y-6">
              <section>
                <h2 className="text-h4 text-text-primary mb-4">Derecho de Reembolso</h2>
                <p className="text-text-secondary">
                  En TCG Iberia, nos comprometemos a ofrecer productos de la más alta calidad. Si no estás satisfecho con tu compra, tienes derecho a un reembolso dentro de 14 días desde la fecha de entrega.
                </p>
              </section>

              <section>
                <h2 className="text-h4 text-text-primary mb-4">Condiciones de Reembolso</h2>
                <ul className="list-disc list-inside space-y-2 text-text-secondary">
                  <li>El producto debe estar en su estado original y sin usar</li>
                  <li>Todos los embalajes originales deben estar intactos</li>
                  <li>Debe incluir todos los accesorios y documentación original</li>
                  <li>No aplica a productos personalizados, bajo reserva, mistery o como apertura en directo</li>
                  <li>La compra debió realizarse en un plazo máximo de 14 días</li>
                </ul>
              </section>

              <section>
                <h2 className="text-h4 text-text-primary mb-4">Proceso de Solicitud</h2>
                <p className="text-text-secondary">
                  Para solicitar un reembolso, contacta con nuestro equipo de atención al cliente en sales@tcgiberia.com con tu número de pedido y detalles de la razón del reembolso.
                </p>
              </section>

              <section>
                <h2 className="text-h4 text-text-primary mb-4">Gastos de Devolución</h2>
                <p className="text-text-secondary">
                  Los gastos de devolución corren por cuenta del cliente, excepto en casos de error en nuestro envío o producto defectuoso.
                </p>
              </section>

              <section>
                <h2 className="text-h4 text-text-primary mb-4">Artículos de Preventa</h2>
                <p className="text-text-secondary">
                  Los productos en pre-order no pueden ser cancelados ni reembolsados, a menos que el pedido sea modificado o cancelado por motivos ajenos a TCG Iberia. Si esto sucede, te contactaremos para informarte de la situación y discutir las opciones para tu pedido.
                  Los artículos que tengan como depósito una pequeña cantidad del total como pago por la reserva, en caso de que el comprador no responda en el momento del pago final tiene un plazo de 7 días para efectuar el pago total o perderá tanto el derecho a adquirir el artículo como el depósito que puso para la reserva.
                  Debido a la alta demanda de algunos artículos podemos sufrir cambios en los pedidos y nos reservamos el derecho a poder cancelar o modificar cualquier artículo en pre-order.
                </p>
              </section>

              <section>
                <h2 className="text-h4 text-text-primary mb-4">Artículos dañados o defectuosos</h2>
                <p className="text-text-secondary">
                  Si recibes un producto dañado o defectuoso, contáctanos dentro de las 48h (dos días) siguientes a la entrega a través de sales@tcgiberia.com, con fotos del daño y una descripción del problema. Revisaremos tu caso y, si es aprobado, te enviaremos un reemplazo o te reembolsaremos el precio completo del producto. En este caso, también reembolsaremos los gastos de envío.
                  Bajo ninguna circunstancia se rembolsara el dinero si una vez recibido el pedido el producto es sacado de su precinto.
                (Si se trata de un artículo TCG bajo ningún concepto se devolverá el dinero si la caja está abierta)
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
