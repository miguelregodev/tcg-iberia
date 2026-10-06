export type ProductLanguage = 'JAPANESE' | 'KOREAN' | 'ENGLISH' | 'SPANISH';

export interface LanguageSeo {
  /** Masculine singular adjective, e.g. "japonés" (for "Booster Box japonés"). */
  adjective: string;
  /** Capitalised label shown in UI/specs. */
  label: string;
  /** Feminine plural adjective, e.g. "japonesas" (for "cartas japonesas"). */
  cardsAdjective: string;
  /** Regex matching a mention of this language inside a product name. */
  namePattern: RegExp;
  /** Dedicated landing page, when one exists. */
  landingPath?: string;
}

export const LANGUAGE_SEO: Record<ProductLanguage, LanguageSeo> = {
  JAPANESE: {
    adjective: 'japonés',
    label: 'Japonés',
    cardsAdjective: 'japonesas',
    namePattern: /japon|japan|\bjp\b|\bjpn\b/i,
    landingPath: '/pokemon-tcg-japones',
  },
  KOREAN: {
    adjective: 'coreano',
    label: 'Coreano',
    cardsAdjective: 'coreanas',
    namePattern: /corean|korea|\bkr\b|\bkor\b/i,
    landingPath: '/pokemon-tcg-coreano',
  },
  ENGLISH: {
    adjective: 'inglés',
    label: 'Inglés',
    cardsAdjective: 'inglesas',
    namePattern: /ingl[eé]s|english/i,
  },
  SPANISH: {
    adjective: 'español',
    label: 'Español',
    cardsAdjective: 'españolas',
    namePattern: /espa[nñ]ol|spanish/i,
  },
};

export function isProductLanguage(value: unknown): value is ProductLanguage {
  return typeof value === 'string' && value in LANGUAGE_SEO;
}
