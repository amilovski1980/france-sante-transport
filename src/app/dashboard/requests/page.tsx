import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ClientDashboard from "@/components/dashboard/ClientDashboard";
import StaffDashboard from "@/components/dashboard/StaffDashboard";
import { loadStaffWorkspace } from "@/lib/staff-data";

export const dynamic = "force-dynamic";

/**
 * Page « Dossiers » :
 * - client    → ses demandes (interface client)
 * - staff     → écran de travail complet (instruction, devis, missions…)
 * - chauffeur → ses missions ; partenaire → ses apports
 */
export default async function RequestsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/dashboard/requests");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const role = profile?.role;

  if (role === "driver") redirect("/dashboard");
  if (role === "partner") redirect("/dashboard/partners");

  if (role === "admin" || role === "dispatcher") {
    const ws = await loadStaffWorkspace(supabase);
    return (
      <StaffDashboard
        isAdmin={role === "admin"}
        requests={ws.requests}
        quotes={ws.quotes}
        shipments={ws.shipments}
        assignments={ws.assignments}
        drivers={ws.drivers}
        vehicles={ws.vehicles}
        events={ws.events}
        positions={ws.positions}
        deliveryProofs={ws.deliveryProofs}
      />
    );
  }

  const [{ data: requests }, { data: quotes }, { data: shipments }, { data: events }] = await Promise.all([
    supabase.from("transport_requests").select("*").order("created_at", { ascending: false }),
    supabase.from("quotes").select("*").order("version", { ascending: false }),
    supabase.from("shipments").select("*").order("scheduled_at", { ascending: true }),
    supabase.from("shipment_events").select("*").order("created_at", { ascending: true }),
  ]);
  return <ClientDashboard requests={requests ?? []} quotes={quotes ?? []} events={events ?? []} shipments={shipments ?? []} />;
}
