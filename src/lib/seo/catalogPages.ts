import type { ProductLanguage } from './languages';

export interface SeoSection {
  heading: string;
  paragraphs: string[];
}

export interface SeoLink {
  href: string;
  label: string;
}

export interface CatalogPageConfig {
  path: string;
  /** Visible H1. */
  title: string;
  /** `<title>` without the brand suffix (the root layout template appends " | TCG Iberia"). */
  metaTitle: string;
  metaDescription: string;
  /** Case-insensitive substring of `Product.type`; empty = every type. */
  productType: string;
  /** Locks the listing to one product language (language landing pages). */
  fixedLanguage?: ProductLanguage;
  eyebrow: string;
  subtitle: string;
  allowedLanguages?: ProductLanguage[];
  showLanguageFilters?: boolean;
  showLanguageFlag?: boolean;
  sections: SeoSection[];
  related: SeoLink[];
}

const GUIDE_BOOSTER_BOX = { href: '/guias/que-es-una-booster-box-pokemon-tcg', label: 'Guía: qué es una booster box de Pokémon TCG' };
const GUIDE_LANGUAGES = { href: '/guias/pokemon-tcg-japones-coreano-chino-diferencias', label: 'Guía: Pokémon TCG japonés, coreano y chino' };
const GUIDE_RARITIES = { href: '/guias/rarezas-pokemon-tcg-ar-sar-sr-ur', label: 'Guía: rarezas AR, SAR, SR y UR' };

export const CATALOG_PAGES: Record<string, CatalogPageConfig> = {
  '/booster-boxes': {
    path: '/booster-boxes',
    title: 'Booster Boxes Pokémon TCG',
    metaTitle: 'Booster Box Pokémon japonesas y coreanas',
    metaDescription:
      'Compra booster boxes de Pokémon TCG en japonés y coreano: cajas selladas con todos los sobres de la expansión, originales y con envío a toda España.',
    productType: 'booster box',
    eyebrow: 'Cajas selladas',
    subtitle:
      'Cajas selladas con todos los sobres de la expansión. La opción preferida por coleccionistas serios.',
    allowedLanguages: ['JAPANESE', 'KOREAN'],
    sections: [
      {
        heading: '¿Qué es una booster box de Pokémon TCG?',
        paragraphs: [
          'Una booster box es una caja sellada que contiene los sobres de una misma expansión de Pokémon TCG. Es el formato elegido por coleccionistas y jugadores para abrir una expansión completa, y la propia caja sellada también se conserva como pieza de colección.',
          'El número de sobres y de cartas por sobre depende del mercado y de la expansión, así que cada ficha de producto detalla lo que incluye esa caja concreta.',
        ],
      },
      {
        heading: 'Booster boxes en japonés y en coreano',
        paragraphs: [
          'Ofrecemos cajas de las ediciones japonesa y coreana de Pokémon TCG, con su propio calendario de lanzamientos y sus cartas exclusivas de cada región. Si dudas entre ediciones, la guía de diferencias te ayuda a elegir.',
          'Algunas cajas también están disponibles en formato Apertura en Directo; antes de elegirlo consulta sus condiciones.',
        ],
      },
    ],
    related: [
      { href: '/pokemon-tcg-japones', label: 'Pokémon TCG japonés' },
      { href: '/pokemon-tcg-coreano', label: 'Pokémon TCG coreano' },
      { href: '/booster-packs', label: 'Sobres sueltos' },
      { href: '/releases-calendar', label: 'Calendario de lanzamientos' },
      { href: '/politica-apertura-en-directo', label: 'Condiciones de Apertura en Directo' },
      GUIDE_BOOSTER_BOX,
      GUIDE_LANGUAGES,
    ],
  },

  '/booster-packs': {
    path: '/booster-packs',
    title: 'Sobres Pokémon TCG',
    metaTitle: 'Sobres Pokémon TCG japoneses, coreanos y más',
    metaDescription:
      'Sobres sueltos de Pokémon TCG en japonés, coreano, inglés y español. Elige la expansión que te falta y recíbela en casa con envío a toda España.',
    productType: 'pack',
    eyebrow: 'Sobres individuales',
    subtitle: 'Sobres sueltos para coleccionistas. Cartas oficiales, listos para abrir.',
    sections: [
      {
        heading: 'Sobres de Pokémon TCG por expansión e idioma',
        paragraphs: [
          'Los sobres son la forma más sencilla de probar una expansión o de completar una colección sin comprar una caja entera. Puedes filtrar por idioma para encontrar sobres japoneses, coreanos, ingleses o españoles.',
          'Si prefieres abrir una expansión completa, consulta nuestras booster boxes.',
        ],
      },
    ],
    related: [
      { href: '/booster-boxes', label: 'Booster boxes' },
      { href: '/booster-bundles', label: 'Booster bundles' },
      { href: '/pokemon-tcg-japones', label: 'Pokémon TCG japonés' },
      { href: '/pokemon-tcg-coreano', label: 'Pokémon TCG coreano' },
      GUIDE_RARITIES,
    ],
  },

  '/booster-bundles': {
    path: '/booster-bundles',
    title: 'Booster Bundles Pokémon TCG',
    metaTitle: 'Booster Bundles Pokémon TCG en inglés y español',
    metaDescription:
      'Booster bundles de Pokémon TCG en inglés y español: packs que agrupan varios sobres de una misma expansión para empezar o ampliar tu colección.',
    productType: 'bundle',
    eyebrow: 'Packs de varios sobres',
    subtitle:
      'Bundles que combinan varios sobres en un solo pack — la forma más cómoda de empezar tu colección.',
    allowedLanguages: ['ENGLISH', 'SPANISH'],
    sections: [
      {
        heading: 'Qué es un booster bundle',
        paragraphs: [
          'Un booster bundle reúne varios sobres de una misma expansión en un único producto sellado. Es una opción intermedia entre el sobre suelto y la booster box, útil para iniciarse o ampliar una colección.',
        ],
      },
    ],
    related: [
      { href: '/booster-packs', label: 'Sobres sueltos' },
      { href: '/etbs', label: 'Elite Trainer Boxes' },
      { href: '/booster-boxes', label: 'Booster boxes' },
    ],
  },

  '/etbs': {
    path: '/etbs',
    title: 'Elite Trainer Boxes Pokémon TCG',
    metaTitle: 'Elite Trainer Box Pokémon TCG en inglés y español',
    metaDescription:
      'Elite Trainer Boxes de Pokémon TCG en inglés y español: sobres, fundas, dados y accesorios en una sola caja para jugar o coleccionar.',
    productType: 'elite trainer box',
    eyebrow: 'Sets de entrenador',
    subtitle:
      'Todo lo que necesitas para jugar como un profesional. Incluye sobres, accesorios y cartas promo exclusivas.',
    allowedLanguages: ['ENGLISH', 'SPANISH'],
    sections: [
      {
        heading: 'Qué incluye una Elite Trainer Box',
        paragraphs: [
          'Una Elite Trainer Box (ETB) combina sobres de una expansión con accesorios de juego, como fundas, cartas de energía, dados y contadores, además de una carta promocional. Por eso es una buena puerta de entrada al juego y un producto muy coleccionable.',
          'El contenido exacto cambia con cada expansión; consulta la ficha del producto antes de comprar.',
        ],
      },
    ],
    related: [
      { href: '/booster-bundles', label: 'Booster bundles' },
      { href: '/booster-packs', label: 'Sobres sueltos' },
      { href: '/accesorios', label: 'Accesorios' },
    ],
  },

  '/mystery-packs': {
    path: '/mystery-packs',
    title: 'Mystery Packs Pokémon TCG',
    metaTitle: 'Mystery Packs Pokémon TCG: paquetes sorpresa',
    metaDescription:
      'Mystery packs de Pokémon TCG: paquetes sorpresa para coleccionistas a quienes les gusta abrir sin saber qué van a encontrar.',
    productType: 'mystery',
    eyebrow: 'Paquetes sorpresa',
    subtitle:
      'Descubre lo inesperado con nuestros paquetes misteriosos. Llenos de sorpresas para coleccionistas aventureros.',
    allowedLanguages: ['ENGLISH', 'JAPANESE', 'KOREAN', 'SPANISH'],
    sections: [
      {
        heading: 'Cómo funcionan los mystery packs',
        paragraphs: [
          'Un mystery pack es un paquete sorpresa: su contenido exacto no se detalla de antemano. Cada ficha explica qué tipo de producto puedes esperar en ese paquete concreto.',
        ],
      },
    ],
    related: [
      { href: '/booster-packs', label: 'Sobres sueltos' },
      { href: '/booster-boxes', label: 'Booster boxes' },
    ],
  },

  '/psa': {
    path: '/psa',
    title: 'Cartas Pokémon gradeadas PSA',
    metaTitle: 'Cartas Pokémon gradeadas PSA',
    metaDescription:
      'Cartas Pokémon TCG gradeadas por PSA, encapsuladas y certificadas. Singles de colección con envío a toda España.',
    productType: 'psa',
    eyebrow: 'Cartas clasificadas',
    subtitle: 'Colecciones de cartas clasificadas por PSA. Cartas auténticas y certificadas.',
    sections: [
      {
        heading: 'Por qué coleccionar cartas gradeadas',
        paragraphs: [
          'Una carta gradeada ha sido evaluada por una empresa externa, que valora su estado y la encapsula en una cápsula sellada con una calificación. Esto facilita comparar el estado de dos cartas y protege la carta del desgaste.',
        ],
      },
    ],
    related: [
      { href: '/raw', label: 'Cartas sueltas sin gradear (Raw)' },
      { href: '/accesorios', label: 'Accesorios para proteger tu colección' },
      GUIDE_RARITIES,
    ],
  },

  '/raw': {
    path: '/raw',
    title: 'Cartas Pokémon sueltas (Raw)',
    metaTitle: 'Cartas Pokémon sueltas sin gradear (Raw)',
    metaDescription:
      'Singles de Pokémon TCG sin gradear (raw): cartas sueltas auténticas para completar tu colección o tu mazo, con envío a toda España.',
    productType: 'raw',
    eyebrow: 'Cartas sin clasificar',
    subtitle: 'Cartas individuales Raw (sin clasificar). Cartas auténticas en perfecto estado.',
    sections: [
      {
        heading: 'Qué significa "raw"',
        paragraphs: [
          'En el coleccionismo, una carta "raw" es una carta suelta que no ha sido gradeada ni encapsulada por una empresa de certificación. Es la opción habitual para completar colecciones y mazos.',
        ],
      },
    ],
    related: [
      { href: '/psa', label: 'Cartas gradeadas PSA' },
      { href: '/accesorios', label: 'Accesorios para proteger tu colección' },
      GUIDE_RARITIES,
    ],
  },

  '/accesorios': {
    path: '/accesorios',
    title: 'Accesorios para cartas Pokémon TCG',
    metaTitle: 'Accesorios para cartas Pokémon TCG',
    metaDescription:
      'Accesorios para proteger y organizar tu colección de cartas Pokémon TCG. Compra online con envío a toda España.',
    productType: 'accesorios',
    eyebrow: 'Accesorios',
    subtitle: 'Accesorios para proteger y organizar tu colección de cartas.',
    showLanguageFilters: false,
    showLanguageFlag: false,
    sections: [
      {
        heading: 'Protege y organiza tu colección',
        paragraphs: [
          'Los accesorios ayudan a conservar el estado de tus cartas y a tenerlas ordenadas. Los accesorios no dependen del idioma de la carta, por eso no se filtran por idioma.',
        ],
      },
    ],
    related: [
      { href: '/psa', label: 'Cartas gradeadas PSA' },
      { href: '/raw', label: 'Cartas sueltas (Raw)' },
      { href: '/booster-boxes', label: 'Booster boxes' },
    ],
  },

  '/pokemon-tcg-japones': {
    path: '/pokemon-tcg-japones',
    title: 'Pokémon TCG japonés',
    metaTitle: 'Cartas Pokémon japonesas: booster box y sobres',
    metaDescription:
      'Pokémon TCG japonés en España: booster boxes, sobres y más productos de la edición original de Japón, con envío a toda España.',
    productType: '',
    fixedLanguage: 'JAPANESE',
    eyebrow: 'Edición de Japón',
    subtitle: 'Booster boxes, sobres y productos de la edición japonesa de Pokémon TCG.',
    showLanguageFilters: false,
    showLanguageFlag: false,
    sections: [
      {
        heading: 'Qué es el Pokémon TCG japonés',
        paragraphs: [
          'El Pokémon TCG japonés es la edición del juego de cartas publicada en Japón, con cartas en japonés. Sus expansiones suelen salir antes que las equivalentes occidentales y tienen su propia numeración y rarezas, entre ellas ilustraciones especiales como las Art Rare (AR) y Special Art Rare (SAR), muy buscadas por coleccionistas.',
        ],
      },
      {
        heading: 'Antes de comprar',
        paragraphs: [
          'Las cartas están escritas en japonés. Si piensas jugar torneos, consulta las normas de tu organizador, porque cada región decide qué idiomas admite. Para coleccionar, la edición japonesa es una de las más populares.',
        ],
      },
    ],
    related: [
      { href: '/booster-boxes?language=JAPANESE', label: 'Booster boxes japonesas' },
      { href: '/booster-packs?language=JAPANESE', label: 'Sobres japoneses' },
      { href: '/pokemon-tcg-coreano', label: 'Pokémon TCG coreano' },
      { href: '/releases-calendar', label: 'Calendario de lanzamientos' },
      GUIDE_LANGUAGES,
      GUIDE_RARITIES,
    ],
  },

  '/pokemon-tcg-coreano': {
    path: '/pokemon-tcg-coreano',
    title: 'Pokémon TCG coreano',
    metaTitle: 'Cartas Pokémon coreanas: booster box y sobres',
    metaDescription:
      'Pokémon TCG coreano en España: booster boxes, sobres y más productos de la edición de Corea del Sur, con envío a toda España.',
    productType: '',
    fixedLanguage: 'KOREAN',
    eyebrow: 'Edición de Corea del Sur',
    subtitle: 'Booster boxes, sobres y productos de la edición coreana de Pokémon TCG.',
    showLanguageFilters: false,
    showLanguageFlag: false,
    sections: [
      {
        heading: 'Qué es el Pokémon TCG coreano',
        paragraphs: [
          'El Pokémon TCG coreano es la edición del juego de cartas publicada en Corea del Sur, con cartas en coreano. Suele basarse en expansiones también publicadas en otras regiones, pero con su propio calendario de lanzamientos y sus propios productos.',
        ],
      },
      {
        heading: 'Antes de comprar',
        paragraphs: [
          'Las cartas están escritas en coreano. Cada producto indica su idioma y, cuando está disponible, su fecha de lanzamiento. Consulta la guía de diferencias para comparar las ediciones.',
        ],
      },
    ],
    related: [
      { href: '/booster-boxes?language=KOREAN', label: 'Booster boxes coreanas' },
      { href: '/booster-packs?language=KOREAN', label: 'Sobres coreanos' },
      { href: '/pokemon-tcg-japones', label: 'Pokémon TCG japonés' },
      { href: '/releases-calendar', label: 'Calendario de lanzamientos' },
      GUIDE_LANGUAGES,
    ],
  },
};

export function getCatalogPage(path: string): CatalogPageConfig {
  const page = CATALOG_PAGES[path];
  if (!page) throw new Error(`Unknown catalog page: ${path}`);
  return page;
}
