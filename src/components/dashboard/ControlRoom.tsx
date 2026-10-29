"use client";
import { useMemo } from "react";
import { formatMoney } from "@/components/dashboard/ClientDashboard";
import CriticalityBadge from "@/components/dashboard/CriticalityBadge";
import Countdown from "@/components/dashboard/Countdown";
import type { Quote, Shipment, TransportRequest } from "@/lib/types";

export default function ControlRoom({ requests, quotes, shipments }: { requests: TransportRequest[]; quotes: Quote[]; shipments: Shipment[] }) {
  const stats = useMemo(() => {
    const accepted = quotes.filter((q) => q.status === "accepted");
    const revenue = accepted.reduce((s, q) => s + Number(q.amount), 0);
    const pending = requests.filter((r) => r.status === "submitted" || r.status === "under_review").length;
    const active = shipments.filter((s) => s.status === "in_progress").length;
    return { revenue, pending, active, margin: Math.round(revenue * 0.26) };
  }, [requests, quotes, shipments]);
  const critical = useMemo(() => requests.filter((r) => r.criticality === "critical" || r.criticality === "urgent").slice(0, 5), [requests]);

  return (
    <div className="min-h-screen bg-[#0a0e17] p-6 text-slate-100">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center justify-between">
          <div><p className="text-xs uppercase tracking-[0.2em] text-slate-500">Salle de controle</p><h1 className="mt-1 text-2xl font-bold text-white">Tableau de bord</h1></div>
          <span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-xs font-semibold text-cyan-300">Temps reel</span>
        </div>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur"><p className="text-xs text-slate-400">Chiffre d'affaires</p><p className="mt-2 text-2xl font-bold tabular-nums text-white">{formatMoney(stats.revenue, "EUR", "fr-FR")}</p><p className="mt-1 text-xs font-semibold text-emerald-400">+12% ce mois</p></div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur"><p className="text-xs text-slate-400">Marge estimee</p><p className="mt-2 text-2xl font-bold tabular-nums text-white">{formatMoney(stats.margin, "EUR", "fr-FR")}</p><p className="mt-1 text-xs font-semibold text-emerald-400">+14%</p></div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur"><p className="text-xs text-slate-400">En attente</p><p className="mt-2 text-2xl font-bold tabular-nums text-cyan-300">{stats.pending}</p><p className="mt-1 text-xs text-slate-500">demandes</p></div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur"><p className="text-xs text-slate-400">En transit</p><p className="mt-2 text-2xl font-bold tabular-nums text-orange-400">{stats.active}</p><p className="mt-1 text-xs text-slate-500">missions</p></div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur">
          <div className="border-b border-white/10 px-5 py-4"><h2 className="text-sm font-semibold text-white">Courses critiques</h2></div>
          <ul className="divide-y divide-white/5">
            {critical.length === 0 && <li className="px-5 py-6 text-sm text-slate-500">Aucune course critique.</li>}
            {critical.map((r) => (<li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3"><div><p className="text-sm text-slate-200">{r.pickup_address} → {r.dropoff_address}</p><p className="text-xs text-slate-500">{r.content_type}</p></div><div className="flex items-center gap-3"><CriticalityBadge level={r.criticality} /><Countdown deadline={r.ischemia_deadline || r.sla_deadline} /></div></li>))}
          </ul>
        </div>
      </div>
    </div>
  );
}

