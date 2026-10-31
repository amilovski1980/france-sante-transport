import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import AdminSidebar from "@/components/dashboard/AdminSidebar";
import SiteSettingsPanel from "@/components/dashboard/SiteSettingsPanel";

export const dynamic = "force-dynamic";

/** Paramètres du site : logo, slogan, CSS personnalisé (admin). */
export default async function SitePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/dashboard/admin/site");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") redirect("/dashboard/requests");

  return (
    <div className="flex min-h-[calc(100vh-4rem)]">
      <AdminSidebar />
      <div className="flex-1 p-6">
        <SiteSettingsPanel />
      </div>
    </div>
  );
}
