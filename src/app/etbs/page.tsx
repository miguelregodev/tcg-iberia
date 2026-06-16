import { Navigation } from "@/components/Navigation";
import { ProductListPage } from "@/components/ProductListPage";
import { Footer } from "@/components/Footer";

interface PageProps {
  searchParams: Promise<{ language?: string }>;
}

export const metadata = {
  title: "Elite Trainer Boxes - TCG Iberia",
  description: "Elite Trainer Boxes de Pokémon TCG en inglés y español",
};

const ALLOWED_LANGUAGES = ['ENGLISH', 'SPANISH'] as const;
type AllowedLanguage = (typeof ALLOWED_LANGUAGES)[number];

export default async function EliteTrainerBoxesPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const raw = params.language as string | undefined;
  const language = raw && (ALLOWED_LANGUAGES as readonly string[]).includes(raw)
    ? (raw as AllowedLanguage)
    : undefined;

  return (
    <>
      <Navigation />
      <ProductListPage
        title="elite trainer boxes"
        productType="elite trainer box"
        language={language}
        eyebrow="Sets de entrenador"
        subtitle="Todo lo que necesitas para jugar como un profesional. Incluye sobres, accesorios y cartas promo exclusivas."
        allowedLanguages={['ENGLISH', 'SPANISH']}
      />
      <Footer />
    </>
  );
}
