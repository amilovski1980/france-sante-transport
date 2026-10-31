import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import FleetPanel from "@/components/dashboard/FleetPanel";
import type { AppRole, Vehicle } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function FleetPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/dashboard/admin/fleet");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin" && profile?.role !== "dispatcher") redirect("/dashboard/requests");

  const { data: vehicles } = await supabase.from("vehicles").select("*").order("registration_plate");

  return <FleetPanel initial={(vehicles ?? []) as Vehicle[]} role={profile.role as AppRole} />;
}
