import { Navigation } from "@/components/Navigation";
import { ProductListPage } from "@/components/ProductListPage";
import { Footer } from "@/components/Footer";

interface PageProps {
  searchParams: Promise<{ language?: string }>;
}

export const metadata = {
  title: "Accesorios - TCG Iberia",
  description: "Accesorios para Pokémon TCG y coleccionismo de cartas",
};

export default async function AccesoriosPage({ searchParams }: PageProps) {
  const params = await searchParams;

  return (
    <>
      <Navigation />
      <ProductListPage
        title="Accesorios"
        productType="Accesorios"
        eyebrow="Accesorios"
        subtitle="Accesorios para proteger y organizar tu colección de cartas."
        showLanguageFilters={false}
        showLanguageFlag={false}
      />
      <Footer />
    </>
  );
}
