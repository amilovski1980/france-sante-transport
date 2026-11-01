"use client";
import { useMemo } from "react";
import { formatMoney } from "@/components/dashboard/ClientDashboard";
import CriticalityBadge from "@/components/dashboard/CriticalityBadge";
import Countdown from "@/components/dashboard/Countdown";
import LiveMap from "@/components/dashboard/LiveMap";
import DispatchBoard from "@/components/dashboard/DispatchBoard";
import { NavIcon } from "@/components/dashboard/NavIcon";
import { useLiveRefresh } from "@/lib/useLiveRefresh";
import type { Quote, Shipment, TransportRequest } from "@/lib/types";

export default function ControlRoom({
  requests,
  quotes,
  shipments,
  positions = [],
  drivers = [],
  assignments = [],
  vehicles = [],
}: {
  requests: TransportRequest[];
  quotes: Quote[];
  shipments: Shipment[];
  positions?: import("@/lib/types").DriverLocation[];
  drivers?: import("@/lib/types").Profile[];
  assignments?: import("@/lib/types").DriverAssignment[];
  vehicles?: import("@/lib/types").Vehicle[];
}) {
  // Positions GPS + flux métier rafraîchis en continu (Realtime → fallback polling 6 s)
  const live = useLiveRefresh(["driver_positions", "shipments", "transport_requests", "quotes"], { pollMs: 6000 });
  const stats = useMemo(() => {
    const accepted = quotes.filter((q) => q.status === "accepted");
    const revenue = accepted.reduce((s, q) => s + Number(q.amount), 0);
    const pending = requests.filter((r) => r.status === "submitted" || r.status === "under_review").length;
    const active = shipments.filter((s) => s.status === "in_progress").length;
    return { revenue, pending, active, margin: Math.round(revenue * 0.26) };
  }, [requests, quotes, shipments]);
  const critical = useMemo(() => requests.filter((r) => r.criticality === "critical" || r.criticality === "urgent").slice(0, 5), [requests]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-navy-400">Salle de contrôle</p>
          <h1 className="mt-1 font-display text-2xl font-bold text-navy-900 dark:text-white">Tableau de bord</h1>
        </div>
        <span
          className={
            live.mode === "realtime" || live.mode === "connecting"
              ? "inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
              : "inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
          }
        >
          <span aria-hidden="true" className="relative flex h-2 w-2">
            {(live.mode === "realtime" || live.mode === "connecting") && (
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            )}
            <span className={`relative inline-flex h-2 w-2 rounded-full ${live.mode === "realtime" || live.mode === "connecting" ? "bg-emerald-500" : "bg-slate-400"}`} />
          </span>
          {live.mode === "realtime" ? "Temps réel" : live.mode === "connecting" ? "Connexion…" : "Interrogation 6 s"}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Chiffre d'affaires" value={formatMoney(stats.revenue, "EUR", "fr-FR")} trend="+12% ce mois" tone="navy" icon={<NavIcon name="wallet" className="h-5 w-5" />} />
        <Stat label="Marge estimée" value={formatMoney(stats.margin, "EUR", "fr-FR")} trend="+14%" tone="green" icon={<NavIcon name="trend" className="h-5 w-5" />} />
        <Stat label="En attente" value={String(stats.pending)} sub="demandes" tone="orange" icon={<NavIcon name="clock" className="h-5 w-5" />} />
        <Stat label="En transit" value={String(stats.active)} sub="missions" tone="blue" icon={<NavIcon name="truck" className="h-5 w-5" />} />
      </div>

      <LiveMap positions={positions} drivers={drivers} />

      <DispatchBoard
        shipments={shipments}
        requests={requests}
        assignments={assignments}
        drivers={drivers}
        vehicles={vehicles}
      />

      <div className="card-pro overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-white/10">
          <h2 className="text-sm font-bold uppercase tracking-wide text-navy-700 dark:text-slate-200">Courses critiques</h2>
          <span className="rounded-md bg-red-500/10 px-2 py-0.5 text-[10px] font-bold tracking-wider text-red-600 dark:text-red-400">{critical.length}</span>
        </div>
        <ul className="divide-y divide-slate-100 dark:divide-white/5">
          {critical.length === 0 && <li className="px-5 py-6 text-sm text-slate-400">Aucune course critique.</li>}
          {critical.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-200">{r.pickup_address} → {r.dropoff_address}</p>
                <p className="text-xs text-slate-400">{r.content_type}</p>
              </div>
              <div className="flex items-center gap-3">
                <CriticalityBadge level={r.criticality} />
                <Countdown deadline={r.ischemia_deadline || r.sla_deadline} />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Stat({ label, value, sub, trend, tone, icon }: {
  label: string;
  value: string;
  sub?: string;
  trend?: string;
  tone: "blue" | "green" | "orange" | "navy";
  icon: React.ReactNode;
}) {
  const ICONS: Record<string, string> = {
    blue: "bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300",
    green: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300",
    orange: "bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300",
    navy: "bg-navy-50 text-navy-700 dark:bg-white/10 dark:text-slate-200",
  };
  return (
    <div className="card-pro p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
          <p className="mt-2 font-display text-2xl font-bold tabular-nums text-navy-900 dark:text-white">{value}</p>
          {sub && <p className="mt-1 text-xs text-slate-400">{sub}</p>}
          {trend && <p className="mt-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">{trend}</p>}
        </div>
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${ICONS[tone]}`}>{icon}</span>
      </div>
    </div>
  );
}
