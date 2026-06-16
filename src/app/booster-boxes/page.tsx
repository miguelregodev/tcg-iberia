import { Navigation } from "@/components/Navigation";
import { ProductListPage } from "@/components/ProductListPage";
import { Footer } from "@/components/Footer";

interface PageProps {
  searchParams: Promise<{ language?: string }>;
}

export const metadata = {
  title: "Booster Boxes - TCG Iberia",
  description: "Booster boxes Pokémon TCG en múltiples idiomas",
};

export default async function BoosterBoxesPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const language = params.language as 'ENGLISH' | 'JAPANESE' | 'KOREAN' | 'SPANISH' | undefined;

  return (
    <>
      <Navigation />
      <ProductListPage
        title="booster boxes"
        productType="booster box"
        language={language}
        eyebrow="Cajas de expansión"
        subtitle="Cajas selladas con todos los sobres de la expansión. La opción preferida por coleccionistas serios."
      />
      <Footer />
    </>
  );
}
