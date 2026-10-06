import { Navigation } from "@/components/Navigation";
import { ProductListPage } from "@/components/ProductListPage";
import { Footer } from "@/components/Footer";

interface PageProps {
  searchParams: Promise<{ language?: string }>;
}

export const metadata = {
  title: "Raw - TCG Iberia",
  description: "Raw (ungraded) Pokémon TCG single cards",
};

export default async function RawPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const language = params.language as 'ENGLISH' | 'JAPANESE' | 'KOREAN' | 'SPANISH' | undefined;

  return (
    <>
      <Navigation />
      <ProductListPage
        title="Raw"
        productType="raw"
        language={language}
        eyebrow="Cartas sin clasificar"
        subtitle="Cartas individuales Raw (sin clasificar). Cartas auténticas en perfecto estado."
      />
      <Footer />
    </>
  );
}
