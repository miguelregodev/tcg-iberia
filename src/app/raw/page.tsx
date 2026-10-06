import { CatalogPage } from "@/components/CatalogPage";
import { getCatalogPage } from "@/lib/seo/catalogPages";
import { generateCategoryMetadata } from "@/lib/seo/metadata";

interface PageProps {
  searchParams: Promise<{ language?: string }>;
}

const config = getCatalogPage("/raw");

export const metadata = generateCategoryMetadata(config);

export default async function RawPage({ searchParams }: PageProps) {
  const { language } = await searchParams;
  return <CatalogPage config={config} languageParam={language} />;
}
