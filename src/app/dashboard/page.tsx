import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ClientDashboard from "@/components/dashboard/ClientDashboard";
import StaffDashboard from "@/components/dashboard/StaffDashboard";
import DriverDashboard from "@/components/dashboard/DriverDashboard";
import type { DriverLocation, Profile, ShipmentEvent } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login?redirect=/dashboard");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return (
      <div className="surface p-8 text-center text-sm text-navy-600">
        Profil indisponible. Reconnectez-vous pour continuer.
      </div>
    );
  }

  const role: Profile["role"] = profile.role;

  if (role === "driver") {
    const [{ data: assignments }, { data: shipments }, { data: requests }, { data: vehicles }] =
      await Promise.all([
        supabase.from("driver_assignments").select("*").order("assigned_at", { ascending: false }),
        supabase.from("shipments").select("*"),
        supabase.from("transport_requests").select("*"),
        supabase.from("vehicles").select("*"),
      ]);

    return (
      <DriverDashboard
        assignments={assignments ?? []}
        shipments={shipments ?? []}
        requests={requests ?? []}
        vehicles={vehicles ?? []}
      />
    );
  }

  if (role === "admin" || role === "dispatcher") {
    const [
      { data: requests },
      { data: quotes },
      { data: shipments },
      { data: assignments },
      { data: vehicles },
      { data: drivers },
      { data: events },
      { data: positions },
    ] = await Promise.all([
      supabase.from("transport_requests").select("*").order("created_at", { ascending: false }),
      supabase.from("quotes").select("*").order("version", { ascending: false }),
      supabase.from("shipments").select("*").order("scheduled_at", { ascending: true }),
      supabase.from("driver_assignments").select("*"),
      supabase.from("vehicles").select("*").order("registration_plate", { ascending: true }),
      supabase
        .from("profiles")
        .select("*")
        .eq("role", "driver")
        .order("email", { ascending: true }),
      supabase
        .from("shipment_events")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50),
      supabase.from("driver_positions").select("*").eq("shared", true),
    ]);

    return (
      <StaffDashboard
        isAdmin={role === "admin"}
        requests={requests ?? []}
        quotes={quotes ?? []}
        shipments={shipments ?? []}
        assignments={assignments ?? []}
        drivers={(drivers as Profile[] | null) ?? []}
        vehicles={vehicles ?? []}
        events={(events as ShipmentEvent[] | null) ?? []}
        positions={(positions as DriverLocation[] | null) ?? []}
      />
    );
  }

  // Client (et partenaires) : leurs propres dossiers (RLS filtrée côté serveur)
  const [{ data: requests }, { data: quotes }, { data: shipments }, { data: events }] =
    await Promise.all([
      supabase
        .from("transport_requests")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase.from("quotes").select("*").order("version", { ascending: false }),
      supabase.from("shipments").select("*").order("scheduled_at", { ascending: true }),
      supabase.from("shipment_events").select("*").order("created_at", { ascending: true }),
    ]);

  return (
    <ClientDashboard
      requests={requests ?? []}
      quotes={quotes ?? []}
      events={events ?? []}
      shipments={shipments ?? []}
    />
  );
}
