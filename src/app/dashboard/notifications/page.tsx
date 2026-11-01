import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import AlertsFeed from "@/components/dashboard/AlertsFeed";
import type {
  AppNotification,
  DriverAssignment,
  Shipment,
  TransportRequest,
} from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/dashboard/notifications");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile) redirect("/dashboard");

  // Notifications personnelles (une ligne par destinataire et par événement).
  const { data: notifications, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100);

  if (!error) {
    return (
      <AlertsFeed
        mode="notifications"
        notifications={(notifications ?? []) as AppNotification[]}
      />
    );
  }

  // Repli tant que la migration « notifications » n'est pas appliquée.
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
    .limit(50);
  return <AlertsFeed mode="feed" events={events ?? []} />;
}
