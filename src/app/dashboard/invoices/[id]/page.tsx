import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import PrintButton from "@/app/dashboard/devis/[id]/PrintButton";
import PayInvoiceButton from "./PayInvoiceButton";
import type { InvoiceStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

const STATUS_FR: Record<InvoiceStatus, string> = {
  issued: "Émise",
  sent: "Envoyée",
  paid: "PAYÉE",
  cancelled: "ANNULÉE",
};

type InvoiceLine = { description: string; quantity: number; unit_price: number };

function money(n: number, currency = "EUR") {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency }).format(n);
}

export default async function InvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: inv } = await supabase
    .from("invoices")
    .select("*")
    .eq("id", id)
    .single();
  if (!inv) notFound();

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  const clientProfile = await supabase
    .from("profiles")
    .select("full_name, email, phone, address")
    .eq("id", inv.client_id)
    .single();
  if (profile?.role !== "admin" && profile?.role !== "dispatcher" && inv.client_id !== user.id) {
    notFound();
  }

  const { data: quote } = await supabase
    .from("quotes")
    .select("id, version, transport_request_id")
    .eq("id", inv.quote_id)
    .single();
  const request = quote
    ? await supabase
        .from("transport_requests")
        .select("pickup_address, dropoff_address, pickup_datetime")
        .eq("id", quote.transport_request_id)
        .single()
    : { data: null };
  const linesData = quote
    ? await supabase
        .from("quote_lines")
        .select("position, description, quantity, unit_price")
        .eq("quote_id", quote.id)
        .order("position")
    : { data: null };
  const lines = ((linesData.data ?? []) as unknown as InvoiceLine[]);
  const vat = Number(inv.vat_rate) / 100;
  const ht = Number(inv.amount);
  const tva = ht * vat;
  const ttc = ht + tva;
  const client = clientProfile.data;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="card-pro overflow-hidden p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-lg font-bold tracking-widest text-navy-900"><span className="text-flagred-600">FRANCE SANTÉ</span> TRANSPORT</p>
            <p className="mt-1 font-display text-2xl font-bold text-navy-800">FACTURE</p>
            <p className="mt-1 text-sm text-slate-400">N° {inv.invoice_number}</p>
          </div>
          <div className="text-right text-sm text-slate-500">
            <p>Émise le {new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" }).format(new Date(inv.issued_at))}</p>
            <p>Échéance {inv.due_at ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" }).format(new Date(inv.due_at)) : "—"}</p>
            <p className={`mt-2 font-bold ${inv.status === "paid" ? "text-emerald-600" : ""}`}>{STATUS_FR[inv.status as InvoiceStatus]}</p>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Destinataire</p>
            <dl className="mt-2 space-y-1 text-slate-700">
              <dt className="font-semibold text-navy-900">{client?.full_name || client?.email}</dt>
              {client?.email && <dd>{client.email}</dd>}
              {client?.phone && <dd>📍 {client.phone}</dd>}
              {client?.address && <dd>{client.address}</dd>}
            </dl>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Prestations</p>
            <dl className="mt-2 space-y-1 text-slate-700">
              {request?.data && (
                <>
                  <dd className="font-semibold text-navy-900">Transport médical (devis v{quote?.version})</dd>
                  <dd>{request.data.pickup_address} → {request.data.dropoff_address}</dd>
                  <dd className="text-slate-500">{new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(new Date(request.data.pickup_datetime))}</dd>
                </>
              )}
            </dl>
          </div>
        </div>

        <table className="mt-8 w-full text-sm">
          <thead>
            <tr className="border-b border-navy-200 text-left text-xs uppercase tracking-wide text-slate-400">
              <th className="pb-2">Désignation</th>
              <th className="pb-2 text-right">Qté</th>
              <th className="pb-2 text-right">Prix unit.</th>
              <th className="pb-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {(lines.length > 0 ? lines : [{ description: "Transport médical", quantity: 1, unit_price: ht }]).map((l, i) => (
              <tr key={i} className="border-b border-slate-100">
                <td className="py-2 text-slate-700">{l.description}</td>
                <td className="py-2 text-right text-slate-500">{l.quantity}</td>
                <td className="py-2 text-right text-slate-500">{money(Number(l.unit_price))}</td>
                <td className="py-2 text-right font-semibold text-navy-900">{money(Number(l.quantity) * Number(l.unit_price))}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-6 flex justify-end">
          <table className="text-sm">
            <tbody>
              <tr><td className="pr-8 py-1 text-slate-500">Total HT</td><td className="text-right font-semibold">{money(ht)}</td></tr>
              <tr><td className="pr-8 py-1 text-slate-500">TVA ({Number(inv.vat_rate)}%)</td><td className="text-right">{money(tva)}</td></tr>
              <tr><td className="pr-8 py-1 text-slate-500">Total</td><td className="text-right">{money(ttc)}</td></tr>
              <tr className="border-t border-navy-200"><td className="pr-8 pt-2 font-bold text-navy-900">TOTAL À PAYER</td><td className="pt-2 text-right font-display text-lg font-bold text-navy-900">{money(ttc)}</td></tr>
            </tbody>
          </table>
        </div>
        {inv.notes && <p className="mt-6 rounded-xl bg-navy-50 px-4 py-3 text-sm text-slate-600">{inv.notes}</p>}
        <p className="mt-8 text-center text-xs text-slate-400">
          France Santé Transport · Faites avancer la santé · paiement à {inv.due_at ? "la date d'échéance" : "30 jours"} — merci de votre confiance.
        </p>
      </div>
      <div className="mt-4 space-y-3">
        {inv.status !== "paid" && inv.status !== "cancelled" && (
          <Suspense fallback={null}>
            <PayInvoiceButton invoiceId={inv.id} />
          </Suspense>
        )}
        <PrintButton />
      </div>
    </div>
  );
}
