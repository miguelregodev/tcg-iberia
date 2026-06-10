import type { Metadata } from "next";
import "@/styles/globals.css";
import { CartProvider } from "@/context/CartContext";

export const metadata: Metadata = {
  title: "TCG Iberia - Premium Pokémon Trading Card Store",
  description: "Authentic, premium Pokémon TCG cards for collectors. Fast EU shipping, collector grade products.",
  keywords: "Pokémon TCG, trading cards, collectors, premium cards, authenticated",
  icons: {
    icon: "/images/logo.png",
  },
  openGraph: {
    title: "TCG Iberia - Premium Pokémon Trading Card Store",
    description: "Authentic, premium Pokémon TCG cards for collectors.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-white text-black antialiased">
        <CartProvider>
          <main>{children}</main>
        </CartProvider>
      </body>
    </html>
  );
}