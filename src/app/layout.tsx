import type { Metadata } from "next";
import "@/styles/globals.css";
import { CartProvider } from "@/context/CartContext";
import { PostHogProvider } from "@/components/providers/PostHogProvider";
import { SessionProvider } from "@/components/providers/SessionProvider";
import { B2BSessionProvider } from "@/context/B2BSessionContext";
import { CookieConsentBanner } from "@/components/CookieConsentBanner";
import { JsonLd } from "@/components/JsonLd";
import { organizationJsonLd, websiteJsonLd } from "@/lib/seo/jsonld";
import { SITE_LANG, SITE_LOCALE, SITE_NAME, SITE_URL } from "@/lib/seo/site";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Tienda Pokémon TCG: cartas japonesas y coreanas | TCG Iberia",
    template: `%s | ${SITE_NAME}`,
  },
  description:
    "Tienda online de Pokémon TCG en España. Booster boxes, sobres y ETBs en japonés, coreano, inglés y español. Productos originales con envío a toda España.",
  applicationName: SITE_NAME,
  icons: {
    icon: "/images/logo.png",
  },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    locale: SITE_LOCALE,
  },
  twitter: {
    card: "summary_large_image",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang={SITE_LANG}>
      <body className="bg-dark-bg text-text-primary antialiased">
        <JsonLd data={[organizationJsonLd(), websiteJsonLd()]} />
        <PostHogProvider>
          <SessionProvider>
            <B2BSessionProvider>
              <CartProvider>
                <main>{children}</main>
                <CookieConsentBanner />
              </CartProvider>
            </B2BSessionProvider>
          </SessionProvider>
        </PostHogProvider>
      </body>
    </html>
  );
}