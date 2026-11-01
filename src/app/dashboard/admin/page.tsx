import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ControlRoom from "@/components/dashboard/ControlRoom";

export const dynamic = "force-dynamic";

export default async function AdminHomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/dashboard/admin");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin" && profile?.role !== "dispatcher") redirect("/dashboard/requests");
  const [
    { data: requests },
    { data: quotes },
    { data: shipments },
    { data: positions },
    { data: drivers },
    { data: assignments },
    { data: vehicles },
  ] = await Promise.all([
    supabase.from("transport_requests").select("*"),
    supabase.from("quotes").select("*"),
    supabase.from("shipments").select("*"),
    supabase.from("driver_positions").select("*").eq("shared", true),
    supabase.from("profiles").select("*").eq("role", "driver"),
    supabase.from("driver_assignments").select("*"),
    supabase.from("vehicles").select("*").order("registration_plate"),
  ]);
  return (
    <ControlRoom
      requests={requests ?? []}
      quotes={quotes ?? []}
      shipments={shipments ?? []}
      positions={positions ?? []}
      drivers={drivers ?? []}
      assignments={assignments ?? []}
      vehicles={vehicles ?? []}
    />
  );
}
