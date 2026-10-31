import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PartnerPanel from "@/components/dashboard/PartnerPanel";
import type { AppRole } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function PartnersPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/dashboard/partners");
  const { data: me } = await supabase
    .from("profiles")
    .select("role, full_name, email")
    .eq("id", user.id)
    .single();
  if (!me) redirect("/dashboard");
  if (me.role !== "partner" && me.role !== "admin" && me.role !== "dispatcher") {
    redirect("/dashboard/requests");
  }

  return <PartnerPanel role={me.role as AppRole} partnerName={me.full_name || me.email} />;
}
