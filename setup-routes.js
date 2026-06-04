const fs = require('fs');
const path = require('path');

const baseDir = path.join(__dirname, 'src', 'app');

const pages = [
  {
    dir: 'booster-boxes',
    title: 'Booster Boxes',
    productType: 'booster box',
    description: 'Browse our premium booster box collection in multiple languages',
  },
  {
    dir: 'booster-packs',
    title: 'Booster Packs',
    productType: 'pack',
    description: 'Browse our premium booster pack collection in multiple languages',
  },
  {
    dir: 'booster-bundles',
    title: 'Booster Bundles',
    productType: 'bundle',
    description: 'Browse our premium booster bundle collection in multiple languages',
  },
];

const pageTemplate = (title, productType, description) => `import { Navigation } from "@/components/Navigation";
import { ProductListPage } from "@/components/ProductListPage";
import { Footer } from "@/components/Footer";

interface PageProps {
  searchParams: Promise<{ language?: string }>;
}

export const metadata = {
  title: "${title} - TCG Iberia",
  description: "${description}",
};

export default async function ${title.replace(/\s+/g, '')}Page({ searchParams }: PageProps) {
  const params = await searchParams;
  const language = params.language as 'ENGLISH' | 'JAPANESE' | 'KOREAN' | 'SPANISH' | undefined;

  return (
    <>
      <Navigation />
      <ProductListPage 
        title="${title}" 
        productType="${productType}"
        language={language}
      />
      <Footer />
    </>
  );
}
`;

pages.forEach(({ dir, title, productType, description }) => {
  const dirPath = path.join(baseDir, dir);
  
  // Create directory
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`✓ Created directory: ${dirPath}`);
  }
  
  // Create page.tsx
  const pagePath = path.join(dirPath, 'page.tsx');
  fs.writeFileSync(pagePath, pageTemplate(title, productType, description));
  console.log(`✓ Created file: ${pagePath}`);
});

console.log('\n✅ All routes created successfully!');
