import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ClientDashboard from "@/components/dashboard/ClientDashboard";

export const dynamic = "force-dynamic";

export default async function RequestsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/dashboard/requests");
  const [{ data: requests }, { data: quotes }, { data: shipments }, { data: events }] = await Promise.all([
    supabase.from("transport_requests").select("*").order("created_at", { ascending: false }),
    supabase.from("quotes").select("*").order("version", { ascending: false }),
    supabase.from("shipments").select("*").order("scheduled_at", { ascending: true }),
    supabase.from("shipment_events").select("*").order("created_at", { ascending: true }),
  ]);
  return <ClientDashboard requests={requests ?? []} quotes={quotes ?? []} events={events ?? []} shipments={shipments ?? []} />;
}
