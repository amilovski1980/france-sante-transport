import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import AgendaTabs from "./AgendaTabs";
import type { DriverAssignment, Profile, Shipment, TransportRequest, Vehicle } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AgendaPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/dashboard/admin/agenda");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin" && profile?.role !== "dispatcher") redirect("/dashboard/requests");

  const [{ data: shipments }, { data: requests }, { data: assignments }, { data: drivers }, { data: vehicles }] =
    await Promise.all([
      supabase.from("shipments").select("*").order("scheduled_at"),
      supabase.from("transport_requests").select("*"),
      supabase.from("driver_assignments").select("*"),
      supabase.from("profiles").select("*").eq("role", "driver").order("email"),
      supabase.from("vehicles").select("*").order("registration_plate"),
    ]);

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-navy-400">Exploitation</p>
        <h1 className="mt-1 font-display text-2xl font-bold text-slate-900 dark:text-white">Agenda & missions</h1>
        <p className="mt-1 text-sm text-slate-400">Calendrier dispatch, planning et performance des chauffeurs.</p>
      </div>
      <AgendaTabs
        shipments={(shipments ?? []) as Shipment[]}
        requests={(requests ?? []) as TransportRequest[]}
        assignments={(assignments ?? []) as DriverAssignment[]}
        drivers={(drivers ?? []) as Profile[]}
        vehicles={(vehicles ?? []) as Vehicle[]}
      />
    </div>
  );
}
