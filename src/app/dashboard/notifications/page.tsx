import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { formatDateTime } from "@/components/dashboard/ClientDashboard";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/dashboard/notifications");
  const { data: events } = await supabase.from("shipment_events").select("*").order("created_at", { ascending: false }).limit(30);
  const list = events ?? [];
  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-semibold text-navy-900 dark:text-slate-100">Notifications</h1>
      {list.length === 0 ? (<p className="surface p-8 text-center text-sm text-navy-500">Aucune notification.</p>) : (
        <ul className="surface divide-y divide-navy-100">
          {list.map((e) => (<li key={e.id} className="flex items-center justify-between px-5 py-3"><span className="text-sm text-navy-800">{e.event_type}</span><span className="text-xs text-navy-400">{formatDateTime(e.created_at, "fr-FR")}</span></li>))}
        </ul>
      )}
    </div>
  );
}
