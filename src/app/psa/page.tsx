import { Navigation } from "@/components/Navigation";
import { ProductListPage } from "@/components/ProductListPage";
import { Footer } from "@/components/Footer";

interface PageProps {
  searchParams: Promise<{ language?: string }>;
}

export const metadata = {
  title: "PSA - TCG Iberia",
  description: "PSA graded Pokémon TCG cards",
};

export default async function PSAPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const language = params.language as 'ENGLISH' | 'JAPANESE' | 'KOREAN' | 'SPANISH' | undefined;

  return (
    <>
      <Navigation />
      <ProductListPage
        title="PSA"
        productType="psa"
        language={language}
        eyebrow="Cartas clasificadas"
        subtitle="Colecciones de cartas clasificadas por PSA. Cartas auténticas y certificadas."
      />
      <Footer />
    </>
  );
}
