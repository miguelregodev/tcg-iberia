import type { SeoLink, SeoSection } from './catalogPages';

export interface Guide {
  slug: string;
  /** Visible H1. */
  title: string;
  /** `<title>` without brand suffix. */
  metaTitle: string;
  description: string;
  intro: string;
  sections: SeoSection[];
  related: SeoLink[];
  datePublished: string;
  dateModified: string;
}

export const GUIDES: Guide[] = [
  {
    slug: 'que-es-una-booster-box-pokemon-tcg',
    title: 'Qué es una booster box de Pokémon TCG y qué contiene',
    metaTitle: 'Qué es una booster box de Pokémon TCG',
    description:
      'Qué es una booster box de Pokémon TCG, cuántos sobres incluye, en qué se diferencia de un sobre, un bundle o una ETB y cómo elegir la caja que más te conviene.',
    intro:
      'Si empiezas a coleccionar Pokémon TCG, antes o después te encontrarás con las booster boxes. Esta guía explica qué son, qué incluyen y cuándo compensa elegirlas frente a otros formatos.',
    datePublished: '2026-10-06',
    dateModified: '2026-10-06',
    sections: [
      {
        heading: 'Qué es una booster box',
        paragraphs: [
          'Una booster box es una caja sellada de fábrica que contiene los sobres (booster packs) de una misma expansión de Pokémon TCG. Es el formato que eligen tanto coleccionistas como jugadores cuando quieren abrir una expansión completa, y la caja sellada también se conserva como pieza de colección.',
        ],
      },
      {
        heading: 'Cuántos sobres y cartas incluye',
        paragraphs: [
          'La cifra depende de la expansión y del mercado. A modo de referencia, las cajas de las expansiones principales japonesas suelen incluir 30 sobres de 5 cartas, mientras que las cajas en inglés de expansiones principales suelen incluir 36 sobres de 10 cartas. Las expansiones pequeñas o especiales pueden variar, por lo que conviene revisar siempre la ficha del producto.',
        ],
      },
      {
        heading: 'Booster box, sobre, bundle o ETB: cuál elegir',
        paragraphs: [
          'El sobre suelto es la opción más económica para probar una expansión. El booster bundle agrupa varios sobres en un único producto. La Elite Trainer Box combina sobres con accesorios de juego y una carta promocional. La booster box ofrece todos los sobres de una expansión en una sola compra, por lo que es la opción habitual para quien quiere abrir muchas cartas de un mismo set.',
        ],
      },
      {
        heading: 'Cajas selladas y Apertura en Directo',
        paragraphs: [
          'En TCG Iberia algunas cajas se ofrecen en dos formatos: Sellado, que se envía precintado, y Apertura en Directo, en el que la caja se abre durante un directo en lugar de enviarse sellada. Cada formato tiene su propio precio y condiciones, que puedes consultar antes de comprar.',
        ],
      },
      {
        heading: 'Cómo comprobar que una caja es original',
        paragraphs: [
          'Comprueba que el film de la caja esté intacto, que el idioma y la edición coincidan con lo que has pedido y compra en tiendas con datos de contacto claros y una política de devolución publicada. Desconfía de precios muy inferiores a los del mercado.',
        ],
      },
    ],
    related: [
      { href: '/booster-boxes', label: 'Ver booster boxes' },
      { href: '/booster-packs', label: 'Ver sobres sueltos' },
      { href: '/politica-apertura-en-directo', label: 'Condiciones de Apertura en Directo' },
      { href: '/guias/pokemon-tcg-japones-coreano-chino-diferencias', label: 'Diferencias entre ediciones' },
    ],
  },
  {
    slug: 'pokemon-tcg-japones-coreano-chino-diferencias',
    title: 'Pokémon TCG japonés, coreano y chino: diferencias para coleccionistas',
    metaTitle: 'Pokémon TCG japonés, coreano y chino: diferencias',
    description:
      'Diferencias entre el Pokémon TCG japonés, coreano, chino y occidental: idioma, calendario de lanzamientos y formatos, para que elijas qué edición comprar.',
    intro:
      'Pokémon TCG se publica en varias ediciones regionales. Cambian el idioma de las cartas, el calendario de lanzamientos y, en ocasiones, los productos disponibles. Estas son las diferencias principales.',
    datePublished: '2026-10-06',
    dateModified: '2026-10-06',
    sections: [
      {
        heading: 'Pokémon TCG japonés',
        paragraphs: [
          'Es la edición publicada en Japón, con cartas en japonés. Sus expansiones suelen salir antes que las equivalentes occidentales y tienen su propia numeración y rarezas, incluidas ilustraciones especiales como las Art Rare y Special Art Rare. Las cajas de expansiones principales suelen incluir menos cartas por sobre que las occidentales.',
        ],
      },
      {
        heading: 'Pokémon TCG coreano',
        paragraphs: [
          'Es la edición publicada en Corea del Sur, con cartas en coreano. Suele basarse en expansiones también publicadas en otras regiones, pero con su propio calendario de lanzamientos y productos propios.',
        ],
      },
      {
        heading: 'Pokémon TCG chino',
        paragraphs: [
          'Existen ediciones en chino simplificado, pensadas para China continental, y en chino tradicional, para mercados como Taiwán y Hong Kong. Cada una tiene sus propios lanzamientos. Actualmente nuestro catálogo se centra en las ediciones japonesa, coreana, inglesa y española.',
        ],
      },
      {
        heading: 'Pokémon TCG en inglés y español',
        paragraphs: [
          'Son las ediciones occidentales, en inglés y en español. Son las habituales para jugar en torneos en Europa y suelen tener más cartas por sobre que las ediciones asiáticas.',
        ],
      },
      {
        heading: 'Cómo elegir edición',
        paragraphs: [
          'Si coleccionas, elige el idioma y la región que más te gusten: el diseño de las cartas, las ilustraciones especiales y los productos exclusivos pueden variar entre ediciones. Si quieres jugar torneos, consulta antes las normas de tu organizador, porque cada región decide qué idiomas admite.',
        ],
      },
    ],
    related: [
      { href: '/pokemon-tcg-japones', label: 'Pokémon TCG japonés' },
      { href: '/pokemon-tcg-coreano', label: 'Pokémon TCG coreano' },
      { href: '/booster-boxes', label: 'Booster boxes' },
      { href: '/guias/rarezas-pokemon-tcg-ar-sar-sr-ur', label: 'Guía de rarezas' },
    ],
  },
  {
    slug: 'rarezas-pokemon-tcg-ar-sar-sr-ur',
    title: 'Rarezas de Pokémon TCG: qué significan AR, SAR, SR y UR',
    metaTitle: 'Rarezas Pokémon TCG: qué significan AR, SAR, SR y UR',
    description:
      'Guía de rarezas de Pokémon TCG: qué significan C, U, R, AR, SAR, SR y UR, cómo identificarlas en la carta y por qué rareza no siempre significa valor.',
    intro:
      'Las siglas de rareza aparecen en muchas fichas y conversaciones de coleccionismo. Aquí tienes un resumen de las más habituales y cómo reconocerlas.',
    datePublished: '2026-10-06',
    dateModified: '2026-10-06',
    sections: [
      {
        heading: 'Rarezas básicas: C, U y R',
        paragraphs: [
          'En la parte inferior de la carta aparece un símbolo de rareza: un círculo indica carta común (C), un rombo indica poco común (U) y una estrella indica rara (R). Son las rarezas que más cartas de cada expansión ocupan.',
        ],
      },
      {
        heading: 'AR, SAR, SR y UR',
        paragraphs: [
          'AR (Art Rare) es una carta con una ilustración artística que ocupa gran parte de la carta, normalmente un Pokémon en su entorno. SAR (Special Art Rare) es una variante más escasa, con ilustración especial, a menudo de Pokémon ex o de cartas de Entrenador. SR (Super Rare) suele ser una carta de arte completo, y UR (Ultra Rare) es una de las rarezas más altas de la expansión, con frecuencia con acabado dorado.',
          'El significado exacto de las siglas puede variar entre eras y regiones, así que conviene comprobarlo con la lista de la expansión concreta.',
        ],
      },
      {
        heading: 'Cómo identificarlas en la carta',
        paragraphs: [
          'Fíjate en el número de la carta: si es mayor que el total del set (por ejemplo, 198/165), suele tratarse de una carta de rareza especial. También puedes comparar el símbolo y el acabado con la lista oficial de la expansión.',
        ],
      },
      {
        heading: 'Rareza no es lo mismo que valor',
        paragraphs: [
          'El precio de una carta depende de la popularidad del Pokémon, de su estado de conservación y de la demanda. Una carta de rareza alta no siempre es la más cotizada de su expansión.',
        ],
      },
    ],
    related: [
      { href: '/raw', label: 'Cartas sueltas (Raw)' },
      { href: '/psa', label: 'Cartas gradeadas PSA' },
      { href: '/pokemon-tcg-japones', label: 'Pokémon TCG japonés' },
      { href: '/guias/que-es-una-booster-box-pokemon-tcg', label: 'Qué es una booster box' },
    ],
  },
];

export function getGuide(slug: string): Guide | undefined {
  return GUIDES.find((g) => g.slug === slug);
}
