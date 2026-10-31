import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import InvoicesPanel, {
  type InvoiceableQuote,
  type InvoiceRow,
} from "@/components/dashboard/InvoicesPanel";
import type { AppRole, RequestStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

type RawInvoiceable = {
  id: string;
  amount: number;
  currency: string;
  version: number;
  transport_request_id: string;
  request: {
    id: string;
    client_id: string;
    pickup_address: string;
    dropoff_address: string;
    status: RequestStatus;
    client: { id: string; full_name: string | null; email: string; role: AppRole } | null;
  } | null;
};

export default async function InvoicesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/dashboard/invoices");
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (me?.role !== "admin" && me?.role !== "dispatcher") redirect("/dashboard/requests");

  const [invoicesQ, invoiceableQ] = await Promise.all([
    supabase
      .from("invoices")
      .select("*, client:profiles!invoices_client_id_fkey(id, full_name, email, role)")
      .order("created_at", { ascending: false }),
    supabase
      .from("quotes")
      .select(
        "id, amount, currency, version, transport_request_id, "
        + "request:transport_requests(id, client_id, pickup_address, dropoff_address, status, "
        + "client:profiles(id, full_name, email, role))",
      )
      .eq("status", "accepted"),
  ]);

  const rawInvoices = (invoicesQ.data ?? []) as unknown as InvoiceRow[];
  const invoicedQuoteIds = new Set(rawInvoices.map((i) => i.quote_id));

  const invoiceable = ((invoiceableQ.data ?? []) as unknown as RawInvoiceable[])
    .filter((q) => !invoicedQuoteIds.has(q.id))
    .map((q): InvoiceableQuote => ({
      id: q.id,
      amount: q.amount,
      currency: q.currency,
      version: q.version,
      transport_request_id: q.transport_request_id,
      request: q.request
        ? {
            id: q.request.id,
            client_id: q.request.client_id,
            pickup_address: q.request.pickup_address,
            dropoff_address: q.request.dropoff_address,
            status: q.request.status,
          }
        : null,
      client: q.request?.client ?? null,
    }));

  return (
    <InvoicesPanel
      invoices={rawInvoices}
      invoiceable={invoiceable}
    />
  );
}
