import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SupplierPlanningPanel from "@/components/dashboard/SupplierPlanningPanel";
import { loadSupplierWorkspace } from "@/lib/supplier-data";

export const dynamic = "force-dynamic";

export default async function SupplierPlanningPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/dashboard/supplier/planning");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "supplier") redirect("/dashboard");

  const workspace = await loadSupplierWorkspace(supabase);
  return <SupplierPlanningPanel workspace={workspace} />;
}
