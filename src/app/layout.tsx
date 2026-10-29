import type { Metadata } from "next";
import { Inter, Manrope } from "next/font/google";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import I18nProvider from "@/components/I18nProvider";
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
    "France Santé Transport : transport de patients et de matériel médical, devis en ligne, suivi traçable et équipes dédiées.",
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
          <Header branding={branding} />
          <main className="flex-1">{children}</main>
          <Footer branding={branding} />
        </I18nProvider>
      </body>
    </html>
  );
}
