import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AdminServicesPanel from "@/components/dashboard/AdminServicesPanel";

export const dynamic = "force-dynamic";

export default async function ServicesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/dashboard/admin/services");
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (me?.role !== "admin" && me?.role !== "dispatcher") redirect("/dashboard/requests");

  return <AdminServicesPanel role={me.role} />;
}
