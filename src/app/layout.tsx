import type { Metadata, Viewport } from "next";
import { Inter, Manrope } from "next/font/google";
import I18nProvider from "@/components/I18nProvider";
import PwaInstaller from "@/components/PwaInstaller";
import { sanitizeCustomCss } from "@/lib/branding";
import { loadBranding } from "@/lib/branding-server";
import { getLocale } from "@/lib/i18n/server";
import "leaflet/dist/leaflet.css";
import "./globals.css";


const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope", display: "swap" });

export const metadata: Metadata = {
  title: {
    default: "France Santé Transport — Le transport qui fait avancer la santé",
    template: "%s · France Santé Transport",
  },
  description:
    "France Santé Transport : acheminement de produits biologiques, pharmaceutiques et médicaux sensibles, devis en ligne, suivi traçable et équipes dédiées.",
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  manifest: "/manifest.webmanifest",
  applicationName: "France Santé Transport",
  appleWebApp: {
    capable: true,
    title: "France Santé Transport",
    statusBarStyle: "default",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#0a1f44",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const branding = await loadBranding();
  const customCss = sanitizeCustomCss(branding.custom_css);
  const locale = await getLocale();

  return (
    <html lang={locale} className={`${inter.variable} ${manrope.variable}`} suppressHydrationWarning>
      <body className="flex min-h-screen flex-col" suppressHydrationWarning>
        {customCss && <style dangerouslySetInnerHTML={{ __html: customCss }} />}
        <I18nProvider initialLocale={locale}>
          {children}
          <PwaInstaller />
        </I18nProvider>
      </body>
    </html>
  );
}
