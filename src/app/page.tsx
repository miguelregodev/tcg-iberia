import { Suspense } from 'react';
import { Navigation } from "@/components/Navigation";
import { Recent } from "@/components/Recent";
import { Featured } from "@/components/Featured";
import { RecentProductCarousel } from "@/components/RecentProductCarousel";
import { FeaturedProductCarousel } from "@/components/FeaturedProductCarousel";
import { PreordersSection } from "@/components/PreordersSection";
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
      <Recent />
      <RecentProductCarousel />
      <PreordersSection />
      <Featured />
      <FeaturedProductCarousel />
      <TrustSection />
      <Footer />
    </>
  );
}