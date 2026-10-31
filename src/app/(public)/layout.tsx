import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { loadBranding } from "@/lib/branding-server";

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const branding = await loadBranding();
  return (
    <>
      <Header branding={branding} />
      <main className="flex-1">{children}</main>
      <Footer branding={branding} />
    </>
  );
}
