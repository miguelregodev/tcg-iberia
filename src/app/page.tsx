import { Suspense } from 'react';
import { Navigation } from "@/components/Navigation";
import { HomeHero } from "@/components/HomeHero";
import { CategoryGrid } from "@/components/CategoryGrid";
import { TrustSection } from "@/components/TrustSection";
import { Footer } from "@/components/Footer";
import { HomeClient } from './HomeClient';

// Safety net for the hero slides query; admin mutations also call revalidatePath('/').
export const revalidate = 60;

export default function Home() {
  return (
    <>
      <Suspense fallback={null}>
        <HomeClient />
      </Suspense>
      <Navigation />
      <HomeHero />
      <CategoryGrid />
      <TrustSection />
      <Footer />
    </>
  );
}