import { Navigation } from '@/components/Navigation';
import { Footer } from '@/components/Footer';
import { SearchResultsPage } from '@/components/SearchResultsPage';

interface PageProps {
  searchParams: Promise<{ q?: string }>;
}

export const metadata = {
  title: 'Búsqueda',
  description: 'Encuentra booster boxes, sobres, ETBs y bundles en el catálogo de TCG Iberia.',
  robots: { index: false, follow: true },
};

export default async function SearchPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const query = typeof params.q === 'string' ? params.q : '';

  return (
    <>
      <Navigation />
      <SearchResultsPage query={query} />
      <Footer />
    </>
  );
}
