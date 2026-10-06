import { CatalogPage } from "@/components/CatalogPage";
import { getCatalogPage } from "@/lib/seo/catalogPages";
import { generateCategoryMetadata } from "@/lib/seo/metadata";

const config = getCatalogPage("/pokemon-tcg-coreano");

export const metadata = generateCategoryMetadata(config);

export const revalidate = 60;

export default function PokemonTcgCoreanoPage() {
  return <CatalogPage config={config} />;
}
