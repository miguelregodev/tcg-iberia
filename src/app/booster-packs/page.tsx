import { Navigation } from "@/components/Navigation";
import { ProductListPage } from "@/components/ProductListPage";
import { Footer } from "@/components/Footer";

interface PageProps {
  searchParams: Promise<{ language?: string }>;
}

export const metadata = {
  title: "Booster Packs - TCG Iberia",
  description: "Booster packs Pokémon TCG en múltiples idiomas",
};

export default async function BoosterPacksPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const language = params.language as 'ENGLISH' | 'JAPANESE' | 'KOREAN' | 'SPANISH' | undefined;

  return (
    <>
      <Navigation />
      <ProductListPage
        title="booster packs"
        productType="pack"
        language={language}
        eyebrow="Sobres individuales"
        subtitle="Sobres sueltos para coleccionistas y jugadores. Cartas oficiales, listas para abrir."
      />
      <Footer />
    </>
  );
}
