import { Suspense } from 'react';
import { Navigation } from "@/components/Navigation";
import { Hero } from "@/components/Hero";
import { CategoryGrid } from "@/components/CategoryGrid";
import { TrustSection } from "@/components/TrustSection";
import { Footer } from "@/components/Footer";
import { HomeClient } from './HomeClient';

export default function Home() {
  return (
    <>
      <Suspense fallback={null}>
        <HomeClient />
      </Suspense>
      <Navigation />
      <Hero />
      <CategoryGrid />
      <TrustSection />
      <Footer />
    </>
  );
}