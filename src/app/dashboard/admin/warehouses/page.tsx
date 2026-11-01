import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AdminWarehousesPanel from "@/components/dashboard/AdminWarehousesPanel";
import type { Warehouse } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminWarehousesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/dashboard/admin/warehouses");

  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (me?.role !== "admin" && me?.role !== "dispatcher") redirect("/dashboard");

  const { data: warehouses } = await supabase.from("warehouses").select("*").order("name");
  return <AdminWarehousesPanel warehouses={(warehouses ?? []) as Warehouse[]} isAdmin={me.role === "admin"} />;
}
