import { Navigation } from "@/components/Navigation";
import { ProductListPage } from "@/components/ProductListPage";
import { Footer } from "@/components/Footer";

interface PageProps {
  searchParams: Promise<{ language?: string }>;
}

export const metadata = {
  title: "Booster Packs - TCG Iberia",
  description: "Browse our premium booster pack collection in multiple languages",
};

export default async function BoosterPacksPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const language = params.language as 'ENGLISH' | 'JAPANESE' | 'KOREAN' | 'SPANISH' | undefined;

  return (
    <>
      <Navigation />
      <ProductListPage 
        title="Booster Packs" 
        productType="pack"
        language={language}
      />
      <Footer />
    </>
  );
}
