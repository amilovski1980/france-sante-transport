import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AdminRecipientsPanel from "@/components/dashboard/AdminRecipientsPanel";
import type { Recipient } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminRecipientsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/dashboard/admin/recipients");

  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (me?.role !== "admin" && me?.role !== "dispatcher") redirect("/dashboard");

  const { data: recipients } = await supabase
    .from("recipients")
    .select("*")
    .is("supplier_id", null)
    .order("name");

  return <AdminRecipientsPanel recipients={(recipients ?? []) as Recipient[]} isAdmin={me.role === "admin"} />;
}
