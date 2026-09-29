import { Navigation } from "@/components/Navigation";
import { ProductListPage } from "@/components/ProductListPage";
import { Footer } from "@/components/Footer";

interface PageProps {
  searchParams: Promise<{ language?: string }>;
}

export const metadata = {
  title: "Mystery Packs - TCG Iberia",
  description: "Paquetes misteriosos de Pokémon TCG con sorpresas",
};

export default async function MysteryPacksPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const language = params.language as 'ENGLISH' | 'JAPANESE' | 'KOREAN' | 'SPANISH' | undefined;

  return (
    <>
      <Navigation />
      <ProductListPage
        title="Mystery Packs"
        productType="Mystery"
        language={language}
        eyebrow="Paquetes sorpresa"
        subtitle="Descubre lo inesperado con nuestros paquetes misteriosos. Llenos de sorpresas para coleccionistas aventureros."
        allowedLanguages={['ENGLISH', 'JAPANESE', 'KOREAN', 'SPANISH']}
      />
      <Footer />
    </>
  );
}
