"use client";

import { useMemo } from "react";
import { useI18n } from "@/components/I18nProvider";
import { RequestStatusBadge } from "@/components/StatusBadge";
import { formatDateTime, formatMoney } from "@/components/dashboard/ClientDashboard";
import type { Quote, Shipment, TransportRequest } from "@/lib/types";

function Kpi({ label, value, trend, tone }: { label: string; value: string; trend?: string; tone: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900">{value}</p>
      {trend && <p className={tone}>{trend}</p>}
    </div>
  );
}

export default function AdminDashboard({ requests, quotes, shipments }: { requests: TransportRequest[]; quotes: Quote[]; shipments: Shipment[] }) {
  const { t, locale } = useI18n();
  const stats = useMemo(() => {
    const today = new Date().toDateString();
    const pending = requests.filter((r) => r.status === "submitted" || r.status === "under_review").length;
    const active = shipments.filter((s) => s.status === "confirmed" || s.status === "in_progress").length;
    const accepted = quotes.filter((q) => q.status === "accepted");
    const revenueToday = accepted.filter((q) => q.accepted_at && new Date(q.accepted_at).toDateString() === today).reduce((sum, q) => sum + Number(q.amount), 0);
    const revenueTotal = accepted.reduce((sum, q) => sum + Number(q.amount), 0);
    return { pending, active, revenueToday, revenueTotal, margin: Math.round(revenueTotal * 0.26) };
  }, [requests, quotes, shipments]);

  const recent = useMemo(() => [...requests].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 8), [requests]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Kpi label="En attente" value={String(stats.pending)} tone="text-slate-400" />
        <Kpi label="CA du jour" value={formatMoney(stats.revenueToday, "EUR", locale)} trend="+12%" tone="text-emerald-600 text-xs font-semibold" />
        <Kpi label="Marge estimee" value={formatMoney(stats.margin, "EUR", locale)} trend="+14%" tone="text-emerald-600 text-xs font-semibold" />
        <Kpi label="Transports actifs" value={String(stats.active)} tone="text-slate-400" />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
          <h3 className="text-sm font-semibold text-slate-800">File des demandes</h3>
          <span className="text-xs text-slate-400">{requests.length}</span>
        </div>
        <ul className="divide-y divide-slate-100">
          {recent.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-3 px-5 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-800">{r.pickup_address} vers {r.dropoff_address}</p>
                <p className="text-xs text-slate-400">{formatDateTime(r.created_at, locale)}</p>
              </div>
              <RequestStatusBadge status={r.status} />
            </li>
          ))}
          {recent.length === 0 && <li className="py-8 text-center text-sm text-slate-500">Aucune demande.</li>}
        </ul>
      </div>
    </div>
  );
}
