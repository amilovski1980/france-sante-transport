import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import AdminSidebar from "@/components/dashboard/AdminSidebar";

export const dynamic = "force-dynamic";

export default async function FleetPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin" && profile?.role !== "dispatcher") redirect("/dashboard/requests");
  const { data: vehicles } = await supabase.from("vehicles").select("*").order("registration_plate");
  const list = vehicles ?? [];
  return (
    <div className="flex min-h-[calc(100vh-4rem)]">
      <AdminSidebar />
      <div className="flex-1 p-6">
        <h1 className="mb-6 text-2xl font-bold text-slate-900">Flotte</h1>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((v) => (
            <div key={v.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="font-semibold text-slate-900">{v.registration_plate}</p>
              <p className="text-xs text-slate-500">{v.vehicle_type} · capacite {v.capacity}</p>
              <p className="mt-1 text-xs font-medium text-emerald-600">{v.active ? "Active" : "Inactive"}</p>
            </div>
          ))}
          {list.length === 0 && <p className="text-sm text-slate-500">Aucun vehicule.</p>}
        </div>
      </div>
    </div>
  );
}
