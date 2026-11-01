import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ClientDashboard from "@/components/dashboard/ClientDashboard";
import DriverApp from "@/components/dashboard/DriverApp";
import HomeHero from "@/components/dashboard/HomeHero";
import type { Profile } from "@/lib/types";

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
      <DriverApp
        driver={profile}
        assignments={assignments ?? []}
        shipments={shipments ?? []}
        requests={requests ?? []}
        vehicles={vehicles ?? []}
      />
    );
  }

  if (role === "admin" || role === "dispatcher") {
    // L'espace de travail staff avec toutes les actions vit sur « Dossiers »
    redirect("/dashboard/requests");
  }

  // Client et partenaire : leurs dossiers / apports (RLS filtrée côté serveur)
  if (role === "partner") {
    redirect("/dashboard/partners");
  }

  // Gestion des rôles inattendus
  if (role !== "client") {
    // Rediriger vers une page d'erreur ou un message d'erreur
    redirect("/login");
  }

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
    <div className="space-y-6">
      <HomeHero profile={profile} pending={(requests ?? []).filter((r) => r.status === "submitted").length} active={(shipments ?? []).filter((s) => s.status === "in_progress" || s.status === "confirmed").length} heroImageUrl="https://images.unsplash.com/photo-1576041046739-116194f5514e?ixlib=rb-4.0.3&auto=format&fit=crop&w=1600&q=80" />
      <ClientDashboard
        requests={requests ?? []}
        quotes={quotes ?? []}
        events={events ?? []}
        shipments={shipments ?? []}
      />
    </div>
  );
}
