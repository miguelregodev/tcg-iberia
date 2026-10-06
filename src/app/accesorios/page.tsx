import { CatalogPage } from "@/components/CatalogPage";
import { getCatalogPage } from "@/lib/seo/catalogPages";
import { generateCategoryMetadata } from "@/lib/seo/metadata";

const config = getCatalogPage("/accesorios");

export const metadata = generateCategoryMetadata(config);

export const revalidate = 60;

export default function AccesoriosPage() {
  return <CatalogPage config={config} />;
}
