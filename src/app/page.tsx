import { Navigation } from "@/components/Navigation";
import { Recent } from "@/components/Recent";
import { Featured } from "@/components/Featured";
import { RecentProductCarousel } from "@/components/RecentProductCarousel";
import { FeaturedProductCarousel } from "@/components/FeaturedProductCarousel";
import { TrustSection } from "@/components/TrustSection";
import { Footer } from "@/components/Footer";

export default function Home() {
  return (
    <>
      <Navigation />
      <Recent />
      <RecentProductCarousel />
      <Featured />
      <FeaturedProductCarousel  />
      <TrustSection />
      <Footer />
    </>
  );
}