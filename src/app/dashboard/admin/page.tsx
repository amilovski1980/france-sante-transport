import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import AdminSidebar from "@/components/dashboard/AdminSidebar";
import AdminDashboard from "@/components/dashboard/AdminDashboard";

export const dynamic = "force-dynamic";

export default async function AdminHomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/dashboard/admin");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin" && profile?.role !== "dispatcher") redirect("/dashboard/requests");
  const [{ data: requests }, { data: quotes }, { data: shipments }] = await Promise.all([
    supabase.from("transport_requests").select("*"),
    supabase.from("quotes").select("*"),
    supabase.from("shipments").select("*"),
  ]);
  return (
    <div className="flex min-h-[calc(100vh-4rem)]">
      <AdminSidebar />
      <div className="flex-1 p-6">
        <h1 className="mb-6 text-2xl font-bold text-slate-900">Vue d'ensemble</h1>
        <AdminDashboard requests={requests ?? []} quotes={quotes ?? []} shipments={shipments ?? []} />
      </div>
    </div>
  );
}
