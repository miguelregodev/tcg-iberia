#!/bin/bash
# Create directory structure and pages for the new routes

# Create directories
mkdir -p src/app/booster-boxes
mkdir -p src/app/booster-packs
mkdir -p src/app/booster-bundles

# Create booster-boxes page
cat > src/app/booster-boxes/page.tsx << 'EOF'
import { Navigation } from "@/components/Navigation";
import { ProductListPage } from "@/components/ProductListPage";
import { Footer } from "@/components/Footer";

interface PageProps {
  searchParams: Promise<{ language?: string }>;
}

export const metadata = {
  title: "Booster Boxes - TCG Iberia",
  description: "Browse our premium booster box collection in multiple languages",
};

export default async function BoosterBoxesPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const language = params.language as 'ENGLISH' | 'JAPANESE' | 'KOREAN' | 'SPANISH' | undefined;

  return (
    <>
      <Navigation />
      <ProductListPage 
        title="Booster Boxes" 
        productType="booster box"
        language={language}
      />
      <Footer />
    </>
  );
}
EOF

# Create booster-packs page
cat > src/app/booster-packs/page.tsx << 'EOF'
import { Navigation } from "@/components/Navigation";
import { ProductListPage } from "@/components/ProductListPage";
import { Footer } from "@/components/Footer";

interface PageProps {
  searchParams: Promise<{ language?: string }>;
}

export const metadata = {
  title: "Booster Packs - TCG Iberia",
  description: "Browse our premium booster pack collection in multiple languages",
};

export default async function BoosterPacksPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const language = params.language as 'ENGLISH' | 'JAPANESE' | 'KOREAN' | 'SPANISH' | undefined;

  return (
    <>
      <Navigation />
      <ProductListPage 
        title="Booster Packs" 
        productType="pack"
        language={language}
      />
      <Footer />
    </>
  );
}
EOF

# Create booster-bundles page
cat > src/app/booster-bundles/page.tsx << 'EOF'
import { Navigation } from "@/components/Navigation";
import { ProductListPage } from "@/components/ProductListPage";
import { Footer } from "@/components/Footer";

interface PageProps {
  searchParams: Promise<{ language?: string }>;
}

export const metadata = {
  title: "Booster Bundles - TCG Iberia",
  description: "Browse our premium booster bundle collection in multiple languages",
};

export default async function BoosterBundlesPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const language = params.language as 'ENGLISH' | 'JAPANESE' | 'KOREAN' | 'SPANISH' | undefined;

  return (
    <>
      <Navigation />
      <ProductListPage 
        title="Booster Bundles" 
        productType="bundle"
        language={language}
      />
      <Footer />
    </>
  );
}
EOF

echo "Routes created successfully!"
