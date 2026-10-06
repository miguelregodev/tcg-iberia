import Link from 'next/link';
import { Navigation } from '@/components/Navigation';
import { Footer } from '@/components/Footer';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { JsonLd } from '@/components/JsonLd';
import { B2BRequestButtons } from '@/components/B2BRequestButtons';
import { buildPageMetadata } from '@/lib/seo/metadata';
import { ORGANIZATION_ID, WEBSITE_ID } from '@/lib/seo/jsonld';
import { SITE_CONTACT, SITE_LANG, absoluteUrl } from '@/lib/seo/site';

const PATH = '/distribuidor-tcg-espana';
const TITLE = 'Proveedor mayorista de Pokémon TCG para tiendas en España';
const DESCRIPTION =
  'Cuentas B2B de TCG Iberia para tiendas, operadores de vending y profesionales en España: tarifas mayoristas de Pokémon TCG, catálogo B2B y facturación con IVA.';

export const metadata = buildPageMetadata({
  title: TITLE,
  description: DESCRIPTION,
  path: PATH,
});

const STEPS = [
  'Solicita tu cuenta B2B indicando tu email.',
  'Te enviamos por email la documentación que necesitamos para verificar tu negocio.',
  'Revisamos los datos y activamos tu cuenta; recibirás un enlace seguro para definir tu contraseña.',
  'Accedes al catálogo B2B con tus tarifas mayoristas y haces tus pedidos desde el portal.',
];

const DOCUMENTS = [
  'Modelo 036 (declaración censal de alta en Hacienda)',
  'Razón social y NIF / CIF / VAT ID',
  'Tipo de actividad: tienda online, tienda física, operador de vending, distribuidor, etc.',
  'Direcciones de envío y de facturación',
  'Datos de la persona de contacto',
];

export default function DistribuidorPage() {
  return (
    <>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          name: TITLE,
          description: DESCRIPTION,
          url: absoluteUrl(PATH),
          inLanguage: SITE_LANG,
          isPartOf: { '@id': WEBSITE_ID },
          about: { '@id': ORGANIZATION_ID },
        }}
      />
      <Navigation />
      <Breadcrumbs items={[{ label: 'Inicio', href: '/' }, { label: 'Distribuidor Pokémon TCG' }]} />

      <div className="bg-dark-bg">
        <div className="container-custom px-4 py-12 md:py-16">
          <div className="max-w-3xl space-y-10">
            <header>
              <h1 className="text-h2 mb-4 text-text-primary">Proveedor mayorista de Pokémon TCG para tiendas y profesionales</h1>
              <p className="text-text-secondary leading-relaxed">
                TCG Iberia suministra producto de Pokémon TCG a negocios en España mediante cuentas B2B con tarifas
                mayoristas. Si tienes una tienda, operas máquinas de vending o revendes de forma profesional, puedes
                solicitar acceso a nuestro catálogo mayorista.
              </p>
              <B2BRequestButtons className="mt-6" />
            </header>

            <section>
              <h2 className="text-xl md:text-2xl font-bold text-text-primary mb-3">Para quién es la cuenta B2B</h2>
              <p className="text-text-secondary leading-relaxed">
                Está pensada para negocios con actividad profesional: tiendas físicas y online, operadores de vending,
                revendedores y distribuidores. Verificamos cada solicitud antes de activar la cuenta, por lo que no está
                disponible para compras de particulares.
              </p>
            </section>

            <section>
              <h2 className="text-xl md:text-2xl font-bold text-text-primary mb-3">Qué incluye tu cuenta</h2>
              <ul className="list-disc pl-5 space-y-2 text-text-secondary leading-relaxed">
                <li>Catálogo B2B con las tarifas mayoristas activas, visibles solo al iniciar sesión.</li>
                <li>Productos de Pokémon TCG en japonés, coreano, inglés y español, siempre en formato sellado.</li>
                <li>Pedidos desde el portal, con historial de pedidos y datos de tu empresa.</li>
                <li>Facturación a empresa con el IVA desglosado.</li>
              </ul>
              <p className="mt-3 text-text-secondary leading-relaxed">
                Las tarifas pueden actualizarse; el importe definitivo de cada pedido se confirma en su factura.
              </p>
            </section>

            <section>
              <h2 className="text-xl md:text-2xl font-bold text-text-primary mb-3">Cómo solicitar tu cuenta</h2>
              <ol className="list-decimal pl-5 space-y-2 text-text-secondary leading-relaxed">
                {STEPS.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>

              <h3 className="mt-6 mb-2 text-lg font-semibold text-text-primary">Documentación que te pediremos</h3>
              <ul className="list-disc pl-5 space-y-1 text-text-secondary leading-relaxed">
                {DOCUMENTS.map((doc) => (
                  <li key={doc}>{doc}</li>
                ))}
              </ul>
            </section>

            <section>
              <h2 className="text-xl md:text-2xl font-bold text-text-primary mb-3">Experiencia en tienda online y vending</h2>
              <p className="text-text-secondary leading-relaxed">
                Además de vender online a particulares, TCG Iberia opera máquinas expendedoras de Pokémon TCG, por lo
                que conocemos las necesidades de operadores y tiendas. Puedes ver el tipo de producto que manejamos en
                nuestras{' '}
                <Link href="/booster-boxes" className="text-premium-gold hover:underline underline-offset-4">
                  booster boxes
                </Link>{' '}
                y en nuestro catálogo de{' '}
                <Link href="/pokemon-tcg-japones" className="text-premium-gold hover:underline underline-offset-4">
                  Pokémon TCG japonés
                </Link>
                .
              </p>
            </section>

            <section>
              <h2 className="text-xl md:text-2xl font-bold text-text-primary mb-3">Contacto comercial</h2>
              <p className="text-text-secondary leading-relaxed">
                Si tienes dudas antes de solicitar la cuenta, escríbenos a{' '}
                <a
                  href={`mailto:${SITE_CONTACT.email}`}
                  className="text-premium-gold hover:underline underline-offset-4"
                >
                  {SITE_CONTACT.email}
                </a>{' '}
                o consulta nuestra{' '}
                <Link href="/contacto" className="text-premium-gold hover:underline underline-offset-4">
                  página de contacto
                </Link>
                .
              </p>
            </section>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
}
