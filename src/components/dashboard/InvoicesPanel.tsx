"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toUserMessage } from "@/lib/errors";
import { createClient } from "@/lib/supabase/client";
import type { AppRole, Invoice, InvoiceStatus, Profile, Quote } from "@/lib/types";

type LightRequest = Pick<import("@/lib/types").TransportRequest, "id" | "client_id" | "pickup_address" | "dropoff_address" | "status">;

interface InvoiceRow extends Invoice {
  client?: Pick<Profile, "id" | "full_name" | "email" | "role"> | null;
}

interface InvoiceableQuote extends Pick<Quote, "id" | "amount" | "currency" | "version" | "transport_request_id"> {
  request?: LightRequest | null;
  client?: Pick<Profile, "id" | "full_name" | "email" | "role"> | null;
}

export type { InvoiceRow, InvoiceableQuote };

const STATUS_STYLES: Record<InvoiceStatus, string> = {
  issued: "bg-navy-50 text-navy-800 dark:bg-white/10 dark:text-slate-200",
  sent: "bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  paid: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  cancelled: "bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-400",
};

const STATUS_LABELS: Record<InvoiceStatus, string> = {
  issued: "Émise",
  sent: "Envoyée",
  paid: "Payée",
  cancelled: "Annulée",
};

function money(n: number, currency = "EUR") {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency }).format(n);
}

export default function InvoicesPanel({
  invoices: initialInvoices,
  invoiceable,
}: {
  invoices: InvoiceRow[];
  invoiceable: InvoiceableQuote[];
}) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [invoices, setInvoices] = useState(initialInvoices);
  const [quoteableList, setQuoteableList] = useState(invoiceable);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | "all">("all");

  const shown = invoices.filter((i) => statusFilter === "all" || i.status === statusFilter);
  const totals = useMemo(() => {
    const active = invoices.filter((i) => i.status !== "cancelled");
    const revenue = active.filter((i) => i.status === "paid").reduce((s, i) => s + Number(i.amount), 0);
    const pending = active.filter((i) => i.status !== "paid").reduce((s, i) => s + Number(i.amount), 0);
    const overdue = active.filter(
      (i) => i.status !== "paid" && i.due_at && new Date(i.due_at).getTime() < Date.now(),
    );
    return {
      revenue,
      pending,
      count: active.length,
      overdueCount: overdue.length,
      overdueAmount: overdue.reduce((s, i) => s + Number(i.amount), 0),
    };
  }, [invoices]);

  function isOverdue(inv: InvoiceRow): boolean {
    return (
      inv.status !== "paid" &&
      inv.status !== "cancelled" &&
      Boolean(inv.due_at) &&
      new Date(inv.due_at as string).getTime() < Date.now()
    );
  }

  async function sendReminders() {
    setBusy("reminders");
    setError(null);
    try {
      const res = await fetch("/api/invoices/reminders", { method: "POST" });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error ?? "Relance impossible");
      } else {
        setError(null);
        setInfo(
          data.overdue === 0
            ? "Aucune facture en retard — rien à relancer."
            : `Relances : ${data.sent} envoi(s)${data.skipped > 0 ? `, ${data.skipped} ignoré(s) (relance < 3 j)` : ""}.`,
        );
      }
    } catch {
      setError("Erreur réseau lors des relances");
    } finally {
      setBusy(null);
    }
  }

  async function createInvoice(quoteId: string) {
    setBusy(quoteId);
    setError(null);
    const { data, error: err } = await supabase.rpc("create_invoice_from_quote", { p_quote_id: quoteId });
    setBusy(null);
    if (err) { setError(toUserMessage(err)); return; }
    if (data) {
      const created = Array.isArray(data) ? data[0] : data;
      const t = quoteableList.find((q) => q.id === quoteId);
      const row: InvoiceRow = { ...(created as Invoice), client: t?.client ?? null };
      setInvoices((prev) => [row, ...prev]);
      setQuoteableList((prev) => prev.filter((q) => q.id !== quoteId));
    }
  }

  async function setStatus(id: string, status: InvoiceStatus) {
    setBusy(id);
    setError(null);
    const patch: Partial<Invoice> = { status };
    if (status === "paid") patch.paid_at = new Date().toISOString();
    const { error: err } = await supabase.from("invoices").update(patch).eq("id", id);
    setBusy(null);
    if (err) { setError(toUserMessage(err)); return; }
    setInvoices((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }

  async function sendEmail(inv: InvoiceRow) {
    setBusy(inv.id);
    setError(null);
    try {
      const res = await fetch("/api/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "invoice_sent", id: inv.id }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError("Envoi e-mail impossible : " + (data.error ?? "erreur inconnue"));
      } else {
        setInvoices((prev) => prev.map((i) => (i.id === inv.id && i.status === "issued" ? { ...i, status: "sent" } : i)));
      }
    } catch {
      setError("Erreur réseau lors de l'envoi e-mail");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-navy-900 dark:text-slate-100">Factures</h1>
          <p className="mt-1 text-sm text-slate-400">Émises en un clic depuis un devis accepté · numérotation FST-{new Date().getFullYear()}-####</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a
            href="/api/invoices/export"
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-navy-700 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
          >
            ⬇️ Export CSV
          </a>
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void sendReminders()}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-navy-700 hover:bg-slate-50 disabled:opacity-40 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
          >
            {busy === "reminders" ? "⏳ Relances…" : `🔁 Relancer les échues (${totals.overdueCount})`}
          </button>
          <div className="rounded-xl bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
            Encaissé : {money(totals.revenue)}
          </div>
          <div className="rounded-xl bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
            En attente : {money(totals.pending)}
          </div>
          {totals.overdueCount > 0 && (
            <div className="rounded-xl bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 dark:bg-red-500/15 dark:text-red-300">
              En retard : {totals.overdueCount} ({money(totals.overdueAmount)})
            </div>
          )}
        </div>
      </div>

      {info && !error && (
        <div className="rounded-xl bg-emerald-50 px-5 py-3 text-sm font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
          ✅ {info}
        </div>
      )}

      {error && <div className="card-pro px-5 py-3 text-sm font-semibold text-red-600">{error}</div>}

      {/* Devis à facturer */}
      {quoteableList.length > 0 && (
        <div className="card-pro overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-4 dark:border-white/10">
            <h2 className="text-sm font-bold uppercase tracking-wide text-navy-700 dark:text-slate-200">
              Devis acceptés à facturer ({quoteableList.length})
            </h2>
          </div>
          <ul className="divide-y divide-slate-100 dark:divide-white/5">
            {quoteableList.map((q) => (
              <li key={q.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                    {q.client?.full_name || q.client?.email || "Client"} · v{q.version}
                  </p>
                  <p className="truncate text-xs text-slate-400">
                    {q.request ? `${q.request.pickup_address} → ${q.request.dropoff_address}` : "—"}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-navy-900 dark:text-slate-100">{money(Number(q.amount))}</span>
                  <button
                    type="button"
                    disabled={busy === q.id}
                    onClick={() => void createInvoice(q.id)}
                    className="rounded-xl bg-navy-700 px-4 py-2 text-xs font-semibold text-white hover:bg-navy-800 disabled:opacity-40"
                  >
                    {busy === q.id ? "…" : "Créer la facture"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Liste des factures */}
      <div className="card-pro overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-4 dark:border-white/10">
          <h2 className="text-sm font-bold uppercase tracking-wide text-navy-700 dark:text-slate-200">Toutes les factures ({invoices.length})</h2>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as InvoiceStatus | "all")}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs dark:border-white/10 dark:bg-[#12161f] dark:text-slate-200"
          >
            <option value="all">Tous les statuts</option>
            {(Object.keys(STATUS_LABELS) as InvoiceStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
          </select>
        </div>
        {shown.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-slate-400">Aucune facture à ce statut.</p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-white/5">
            {shown.map((inv) => (
              <li key={inv.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                    <span className="font-mono">{inv.invoice_number}</span> · {inv.client?.full_name || inv.client?.email || "Client"}
                    {isOverdue(inv) && (
                      <span className="ml-2 rounded-md bg-red-50 px-1.5 py-0.5 align-middle text-[10px] font-bold text-red-600 dark:bg-red-500/15 dark:text-red-300">
                        EN RETARD
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-slate-400">
                    Émise le {new Intl.DateTimeFormat("fr-FR", { dateStyle: "short" }).format(new Date(inv.issued_at))}
                    {inv.due_at && <> · échéance {new Intl.DateTimeFormat("fr-FR", { dateStyle: "short" }).format(new Date(inv.due_at))}</>}
                    {inv.paid_at && <> · encaissée le {new Intl.DateTimeFormat("fr-FR", { dateStyle: "short" }).format(new Date(inv.paid_at))}</>}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-bold text-navy-900 dark:text-slate-100">{money(Number(inv.amount), inv.currency)}</span>
                  <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${STATUS_STYLES[inv.status]}`}>{STATUS_LABELS[inv.status]}</span>
                  <Link
                    href={`/dashboard/invoices/${inv.id}`}
                    className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-navy-700 hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10"
                  >
                    Détail
                  </Link>
                  {inv.status === "issued" && (
                    <button type="button" disabled={busy === inv.id} onClick={() => void sendEmail(inv)}
                      className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-navy-700 hover:bg-slate-50 disabled:opacity-40 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10">
                      ✉️ Envoyer
                    </button>
                  )}
                  {inv.status === "sent" && (
                    <>
                      <button type="button" disabled={busy === inv.id} onClick={() => void setStatus(inv.id, "paid")}
                        className="rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-40">
                        💰 Encaisser
                      </button>
                      <button type="button" disabled={busy === inv.id} onClick={() => void setStatus(inv.id, "cancelled")}
                        className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-50 disabled:opacity-40 dark:border-white/10 dark:hover:bg-white/10">
                        Annuler
                      </button>
                    </>
                  )}
                  {inv.status === "paid" && (
                    <button type="button" disabled={busy === inv.id} onClick={() => void router.refresh()}
                      className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
                      Réglée ✓
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
