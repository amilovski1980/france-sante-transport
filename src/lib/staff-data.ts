import type { createClient } from "@/lib/supabase/server";
import type { DeliveryProof, DriverLocation, Profile, ShipmentEvent } from "@/lib/types";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/**
 * Charge l'espace de travail staff (toutes les données avec RLS élargie) :
 * demandes, devis, missions, affectations, flotte, chauffeurs, events, positions,
 * preuves de livraison.
 * Utilisé par les pages serving le staff (Dossiers, tableau de bord).
 */
export async function loadStaffWorkspace(supabase: Supabase) {
  const [
    { data: requests },
    { data: quotes },
    { data: shipments },
    { data: assignments },
    { data: vehicles },
    { data: drivers },
    { data: events },
    { data: positions },
    { data: deliveryProofs },
  ] = await Promise.all([
    supabase.from("transport_requests").select("*").order("created_at", { ascending: false }),
    supabase.from("quotes").select("*").order("version", { ascending: false }),
    supabase.from("shipments").select("*").order("scheduled_at", { ascending: true }),
    supabase.from("driver_assignments").select("*"),
    supabase.from("vehicles").select("*").order("registration_plate", { ascending: true }),
    supabase.from("profiles").select("*").eq("role", "driver").order("email", { ascending: true }),
    supabase.from("shipment_events").select("*").order("created_at", { ascending: false }).limit(50),
    supabase.from("driver_positions").select("*").eq("shared", true),
    supabase.from("delivery_proofs").select("*").order("created_at", { ascending: false }),
  ]);

  return {
    requests: requests ?? [],
    quotes: quotes ?? [],
    shipments: shipments ?? [],
    assignments: assignments ?? [],
    vehicles: vehicles ?? [],
    drivers: (drivers as Profile[] | null) ?? [],
    events: (events as ShipmentEvent[] | null) ?? [],
    positions: (positions as DriverLocation[] | null) ?? [],
    deliveryProofs: (deliveryProofs as DeliveryProof[] | null) ?? [],
  };
}
