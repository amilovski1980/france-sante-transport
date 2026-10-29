import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import AdminSidebar from "@/components/dashboard/AdminSidebar";
import DispatchCalendar from "@/components/dashboard/DispatchCalendar";

export const dynamic = "force-dynamic";

export default async function AgendaPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin" && profile?.role !== "dispatcher") redirect("/dashboard/requests");
  const [{ data: shipments }, { data: requests }, { data: assignments }, { data: drivers }] = await Promise.all([
    supabase.from("shipments").select("*").order("scheduled_at"),
    supabase.from("transport_requests").select("*"),
    supabase.from("driver_assignments").select("*"),
    supabase.from("profiles").select("*").eq("role", "driver"),
  ]);
  return (
    <div className="flex min-h-[calc(100vh-4rem)]">
      <AdminSidebar />
      <div className="flex-1 p-6">
        <h1 className="mb-6 text-2xl font-bold text-slate-900">Agenda</h1>
        <DispatchCalendar shipments={shipments ?? []} requests={requests ?? []} assignments={assignments ?? []} drivers={drivers ?? []} />
      </div>
    </div>
  );
}
