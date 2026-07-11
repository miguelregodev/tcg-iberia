import { Navigation } from '@/components/Navigation';
import { Footer } from '@/components/Footer';
import { B2BCatalogPage } from '@/components/B2BCatalogPage';

interface PageProps {
  searchParams: Promise<{ language?: string }>;
}

export const metadata = {
  title: 'Catálogo B2B - TCG Iberia',
  description: 'Catálogo mayorista con precios B2B exclusivos',
};

export default async function B2BCatalogRoute({ searchParams }: PageProps) {
  const params = await searchParams;
  const language = params.language as
    | 'ENGLISH'
    | 'JAPANESE'
    | 'KOREAN'
    | 'SPANISH'
    | undefined;

  return (
    <>
      <Navigation />
      <B2BCatalogPage language={language} />
      <Footer />
    </>
  );
}
