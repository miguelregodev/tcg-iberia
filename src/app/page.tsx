import { Navigation } from "@/components/Navigation";
import { Hero } from "@/components/Hero";
import { ProductCatalog } from "@/components/ProductCatalog";
import { TrustSection } from "@/components/TrustSection";
import { Footer } from "@/components/Footer";

export default function Home() {
  return (
    <>
      <Navigation />
      <Hero />
      <ProductCatalog />
      <TrustSection />
      <Footer />
    </>
  );
}