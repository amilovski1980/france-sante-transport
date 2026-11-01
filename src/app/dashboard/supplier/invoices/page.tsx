import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SupplierInvoicesPanel from "@/components/dashboard/SupplierInvoicesPanel";
import { loadSupplierWorkspace } from "@/lib/supplier-data";

export const dynamic = "force-dynamic";

export default async function SupplierInvoicesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/dashboard/supplier/invoices");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "supplier") redirect("/dashboard");

  const workspace = await loadSupplierWorkspace(supabase);
  return <SupplierInvoicesPanel workspace={workspace} />;
}
