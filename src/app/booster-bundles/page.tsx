import { Navigation } from "@/components/Navigation";
import { ProductListPage } from "@/components/ProductListPage";
import { Footer } from "@/components/Footer";

interface PageProps {
  searchParams: Promise<{ language?: string }>;
}

export const metadata = {
  title: "Booster Bundles - TCG Iberia",
  description: "Booster bundles Pokémon TCG en múltiples idiomas",
};

export default async function BoosterBundlesPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const language = params.language as 'ENGLISH' | 'JAPANESE' | 'KOREAN' | 'SPANISH' | undefined;

  return (
    <>
      <Navigation />
      <ProductListPage
        title="Booster Bundles"
        productType="bundle"
        language={language}
        eyebrow="Packs de varios sobres"
        subtitle="Bundles que combinan varios sobres en un solo pack — la forma más cómoda de empezar tu colección."
      />
      <Footer />
    </>
  );
}
