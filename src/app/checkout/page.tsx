import { CheckoutForm } from '@/components/CheckoutForm';
import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";

export default function CheckoutPage() {
  return (
    <>
    <Navigation />
    <main className="min-h-screen bg-gray-50 py-12">
      <div className="container-custom px-4">
        <CheckoutForm />
      </div>
    </main>
    <Footer />
    </>
  );
}
