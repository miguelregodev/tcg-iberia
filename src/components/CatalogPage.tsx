import { Navigation } from '@/components/Navigation';
import { Footer } from '@/components/Footer';
import { JsonLd } from '@/components/JsonLd';
import { ProductListPage } from '@/components/ProductListPage';
import { SeoContent } from '@/components/SeoContent';
import { getPublicCatalog } from '@/lib/products/catalog';
import { filterListingProducts } from '@/lib/products/listing';
import { collectionPageJsonLd } from '@/lib/seo/jsonld';
import { isProductLanguage, type ProductLanguage } from '@/lib/seo/languages';
import type { CatalogPageConfig } from '@/lib/seo/catalogPages';
import type { Product } from '@/types';

interface CatalogPageProps {
  config: CatalogPageConfig;
  /** Raw `?language=` value. Applied as a UX filter only; canonical stays on the base URL. */
  languageParam?: string;
}

function resolveLanguage(config: CatalogPageConfig, languageParam?: string): ProductLanguage | undefined {
  if (config.fixedLanguage) return config.fixedLanguage;
  if (!isProductLanguage(languageParam)) return undefined;
  if (config.allowedLanguages && !config.allowedLanguages.includes(languageParam)) return undefined;
  return languageParam;
}

/** Server-rendered category/landing page: products and copy are in the initial HTML. */
export async function CatalogPage({ config, languageParam }: CatalogPageProps) {
  const language = resolveLanguage(config, languageParam);

  let canonicalProducts: Product[] | undefined;
  try {
    const catalog = await getPublicCatalog();
    canonicalProducts = filterListingProducts(catalog, {
      productType: config.productType,
      language: config.fixedLanguage,
    });
  } catch (error) {
    // Falls back to the client-side fetch in ProductListPage.
    console.error(`CatalogPage ${config.path}: failed to load catalog`, error);
  }

  const displayed =
    canonicalProducts && language && !config.fixedLanguage
      ? canonicalProducts.filter((p) => p.language === language)
      : canonicalProducts;

  return (
    <>
      <JsonLd
        data={collectionPageJsonLd({
          name: config.title,
          description: config.metaDescription,
          path: config.path,
          products: canonicalProducts ?? [],
        })}
      />
      <Navigation />
      <ProductListPage
        key={language ?? 'all'}
        title={config.title}
        productType={config.productType}
        language={language}
        eyebrow={config.eyebrow}
        subtitle={config.subtitle}
        allowedLanguages={config.allowedLanguages}
        showLanguageFilters={config.showLanguageFilters}
        showLanguageFlag={config.showLanguageFlag}
        initialProducts={displayed}
      >
        <SeoContent sections={config.sections} related={config.related} />
      </ProductListPage>
      <Footer />
    </>
  );
}
