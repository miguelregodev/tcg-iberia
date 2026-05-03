import { Navigation } from "@/components/Navigation";
import { Hero } from "@/components/Hero";
import { ProductCatalog } from "@/components/ProductCatalog";
import { TrustSection } from "@/components/TrustSection";
import { ContactCTA } from "@/components/ContactCTA";
import { Footer } from "@/components/Footer";

export default function Home() {
  return (
    <>
      <Navigation />
      <Hero />
      <ProductCatalog />
      <TrustSection />
      <ContactCTA />
      <Footer />
    </>
  );
}