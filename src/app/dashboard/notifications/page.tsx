import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import AlertsFeed from "@/components/dashboard/AlertsFeed";
import type { DriverAssignment, Shipment, TransportRequest } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/dashboard/notifications");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile) redirect("/dashboard");

  // Chauffeurs : flux construit sur leurs affectations (la RLS bloque
  // shipment_events pour eux) — staff/clients : journal des évènements.
  if (profile.role === "driver") {
    const [{ data: assignments }, { data: shipments }, { data: requests }] = await Promise.all([
      supabase.from("driver_assignments").select("*").order("assigned_at", { ascending: false }).limit(30),
      supabase.from("shipments").select("*"),
      supabase.from("transport_requests").select("*"),
    ]);
    return (
      <AlertsFeed
        mode="driver"
        assignments={(assignments ?? []) as DriverAssignment[]}
        shipments={(shipments ?? []) as Shipment[]}
        requests={(requests ?? []) as TransportRequest[]}
      />
    );
  }

  const { data: events } = await supabase
    .from("shipment_events")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(30);
  return <AlertsFeed mode="feed" events={events ?? []} />;
}
