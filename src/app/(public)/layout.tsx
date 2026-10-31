import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AminiaAssistant from "@/components/AminiaAssistant";
import MobileCtaBar from "@/components/MobileCtaBar";
import { loadBranding } from "@/lib/branding-server";

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const branding = await loadBranding();
  return (
    <>
      <Header branding={branding} />
      <main className="flex-1 pb-[4.75rem] md:pb-0">{children}</main>
      <Footer branding={branding} />
      <AminiaAssistant newsletterUrl={branding?.newsletter_url ?? null} />
      <MobileCtaBar />
    </>
  );
}
