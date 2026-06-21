import { Navigation } from "@/components/Navigation";
import { ProductListPage } from "@/components/ProductListPage";
import { Footer } from "@/components/Footer";

interface PageProps {
  searchParams: Promise<{ language?: string }>;
}

export const metadata = {
  title: "Booster Bundles - TCG Iberia",
  description: "Booster bundles Pokémon TCG en inglés y español",
};

const ALLOWED_LANGUAGES = ['ENGLISH', 'SPANISH'] as const;
type AllowedLanguage = (typeof ALLOWED_LANGUAGES)[number];

export default async function BoosterBundlesPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const raw = params.language as string | undefined;
  const language = raw && (ALLOWED_LANGUAGES as readonly string[]).includes(raw)
    ? (raw as AllowedLanguage)
    : undefined;

  return (
    <>
      <Navigation />
      <ProductListPage
        title="booster bundles"
        productType="bundle"
        language={language}
        eyebrow="Packs de varios sobres"
        subtitle="Bundles que combinan varios sobres en un solo pack — la forma más cómoda de empezar tu colección."
        allowedLanguages={['ENGLISH', 'SPANISH']}
      />
      <Footer />
    </>
  );
}
