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

  const quoteIds = (quotes ?? []).map((quote) => quote.id);
  const [{ data: esignDocs }, { data: invoices }] = quoteIds.length
    ? await Promise.all([
        supabase
          .from("esign_documents")
          .select("reference_id, status")
          .eq("scope", "quote")
          .in("reference_id", quoteIds)
          .order("created_at", { ascending: false }),
        supabase
          .from("invoices")
          .select("quote_id, id, status")
          .in("quote_id", quoteIds),
      ])
    : [{ data: [] }, { data: [] }];

  const esignByQuote: Record<string, import("@/lib/types").EsignStatus> = {};
  for (const doc of esignDocs ?? []) {
    if (!esignByQuote[doc.reference_id]) esignByQuote[doc.reference_id] = doc.status as import("@/lib/types").EsignStatus;
  }
  const invoiceByQuote: Record<string, { id: string; status: import("@/lib/types").InvoiceStatus }> = {};
  for (const invoice of invoices ?? []) {
    invoiceByQuote[invoice.quote_id] = { id: invoice.id, status: invoice.status as import("@/lib/types").InvoiceStatus };
  }

  return (
    <ClientDashboard
      requests={requests ?? []}
      quotes={quotes ?? []}
      events={events ?? []}
      shipments={shipments ?? []}
      esignByQuote={esignByQuote}
      invoiceByQuote={invoiceByQuote}
    />
  );
}
