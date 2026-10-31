"use client";

import { useLiveRefresh } from "@/lib/useLiveRefresh";
import { formatDateTime } from "@/components/dashboard/ClientDashboard";
import type { DriverAssignment, ShipmentEvent, TransportRequest } from "@/lib/types";

const EVENT_META: Record<string, { icon: string; label: string; tone: string }> = {
  request_submitted: { icon: "📥", label: "Demande enregistrée", tone: "bg-navy-50 text-navy-700 dark:bg-white/10 dark:text-slate-200" },
  quote_sent: { icon: "📄", label: "Devis envoyé", tone: "bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300" },
  shipment_confirmed: { icon: "✅", label: "Mission confirmée", tone: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" },
  shipment_started: { icon: "🚐", label: "Départ", tone: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300" },
  patient_picked_up: { icon: "🧑‍⚕️", label: "Patient pris en charge", tone: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300" },
  shipment_completed: { icon: "🏁", label: "Mission terminée", tone: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" },
  shipment_cancelled: { icon: "⛔", label: "Mission annulée", tone: "bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300" },
};

function relative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "à l'instant";
  if (mins < 60) return `il y a ${mins} min`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `il y a ${hours} h`;
  return `il y a ${Math.round(hours / 24)} j`;
}

type Props =
  | {
      mode: "feed";
      events: ShipmentEvent[];
    }
  | {
      mode: "driver";
      assignments: DriverAssignment[];
      shipments: { id: string; scheduled_at: string; status: string; transport_request_id: string | null }[];
      requests: TransportRequest[];
    };

export default function AlertsFeed(props: Props) {
  const live = useLiveRefresh(["shipment_events", "driver_assignments", "shipments"], { pollMs: 6000 });

  const rows: Array<{ id: string; icon: string; title: string; detail: string; time: string; tone: string }> = [];

  if (props.mode === "driver") {
    const requestById = new Map(props.requests.map((r) => [r.id, r]));
    const shipmentById = new Map(props.shipments.map((s) => [s.id, s]));
    for (const a of props.assignments) {
      const s = shipmentById.get(a.shipment_id);
      const r = s ? requestById.get(s?.transport_request_id ?? "") : undefined;
      rows.push({
        id: a.id,
        icon: a.status === "proposed" ? "🔔" : a.status === "completed" ? "🏁" : "🚐",
        title:
          a.status === "proposed"
            ? "Mission proposée par le dispatch"
            : a.status === "accepted"
              ? "Mission acceptée — en attente du départ"
              : a.status === "declined"
                ? "Mission refusée"
                : "Mission terminée",
        detail: r ? `${r.pickup_address} → ${r.dropoff_address}` : "Détails à venir",
        time: a.assigned_at,
        tone:
          a.status === "proposed"
            ? "bg-flagred-600 text-white"
            : a.status === "declined"
              ? "bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-400"
              : "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
      });
    }
  } else {
    for (const e of props.events) {
      const meta = EVENT_META[e.event_type] ?? { icon: "•", label: e.event_type, tone: "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300" };
      rows.push({ id: e.id, icon: meta.icon, title: meta.label, detail: "", time: e.created_at, tone: meta.tone });
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-navy-900 dark:text-slate-100">Alertes</h1>
          <p className="mt-0.5 text-xs text-slate-400">
            {rows.length > 0 ? `${rows.length} élément${rows.length > 1 ? "s" : ""} · dernier feed : ${relative(rows[0].time)}` : "Historique des notifications"}
          </p>
        </div>
        <span
          className={
            live.mode === "realtime" || live.mode === "connecting"
              ? "inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
              : "inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
          }
        >
          <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />
          {live.mode === "realtime" ? "Temps réel" : live.mode === "connecting" ? "Connexion…" : "Maj 6 s"}
        </span>
      </div>

      {rows.length === 0 ? (
        <div className="card-pro p-10 text-center">
          <p className="text-4xl" aria-hidden="true">🔔</p>
          <p className="mt-3 font-display text-lg font-semibold text-navy-900 dark:text-slate-100">Aucune alerte</p>
          <p className="mx-auto mt-2 max-w-xs text-sm text-slate-400">
            Vous recevrez ici les notifications liées à vos dossiers et missions — activez les notifications navigateur dans Paramètres.
          </p>
        </div>
      ) : (
        <ul className="card-pro divide-y divide-slate-100 overflow-hidden dark:divide-white/5">
          {rows.map((row) => (
            <li key={row.id} className="flex items-center gap-4 px-5 py-3.5">
              <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl text-sm ${row.tone}`}>
                {row.icon}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-200">{row.title}</p>
                {row.detail && <p className="truncate text-xs text-slate-400">{row.detail}</p>}
              </div>
              <span className="shrink-0 text-right text-[11px] text-slate-400">{relative(row.time)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
