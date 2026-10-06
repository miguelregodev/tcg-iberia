import { Suspense } from 'react';
import { Navigation } from "@/components/Navigation";
import { Hero } from "@/components/Hero";
import { CategoryGrid } from "@/components/CategoryGrid";
import { HomeIntro } from "@/components/HomeIntro";
import { TrustSection } from "@/components/TrustSection";
import { Footer } from "@/components/Footer";
import { HomeClient } from './HomeClient';
import { buildPageMetadata } from '@/lib/seo/metadata';

export const metadata = buildPageMetadata({
  title: 'Tienda Pokémon TCG: cartas japonesas y coreanas | TCG Iberia',
  description:
    'Tienda online de Pokémon TCG en España. Booster boxes, sobres y ETBs en japonés, coreano, inglés y español. Productos originales con envío a toda España.',
  path: '/',
  absoluteTitle: true,
});

export default function Home() {
  return (
    <>
      <Suspense fallback={null}>
        <HomeClient />
      </Suspense>
      <Navigation />
      <Hero />
      <CategoryGrid />
      <HomeIntro />
      <TrustSection />
      <Footer />
    </>
  );
}