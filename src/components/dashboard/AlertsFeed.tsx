"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useLiveRefresh } from "@/lib/useLiveRefresh";
import { createClient } from "@/lib/supabase/client";
import { formatDateTime } from "@/components/dashboard/ClientDashboard";
import { NavIcon, type NavIconName } from "@/components/dashboard/NavIcon";
import type {
  AppNotification,
  DriverAssignment,
  ShipmentEvent,
  TransportRequest,
} from "@/lib/types";

const EVENT_META: Record<string, { icon: NavIconName; label: string; tone: string }> = {
  request_submitted: { icon: "list", label: "Demande enregistrée", tone: "bg-navy-50 text-navy-700 dark:bg-white/10 dark:text-slate-200" },
  quote_sent: { icon: "money", label: "Devis envoyé", tone: "bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300" },
  shipment_confirmed: { icon: "check", label: "Mission confirmée", tone: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" },
  shipment_started: { icon: "truck", label: "Enlèvement en cours", tone: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300" },
  patient_picked_up: { icon: "box", label: "Envoi enlevé par le chauffeur", tone: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300" },
  shipment_completed: { icon: "check", label: "Mission terminée", tone: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" },
  shipment_cancelled: { icon: "ban", label: "Mission annulée", tone: "bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300" },
};

const NOTIFICATION_META: Record<string, { icon: NavIconName; tone: string }> = {
  request_received: { icon: "list", tone: "bg-flagred-600 text-white" },
  request_received_ack: { icon: "list", tone: "bg-navy-50 text-navy-700 dark:bg-white/10 dark:text-slate-200" },
  request_under_review: { icon: "search", tone: "bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300" },
  request_cancelled: { icon: "ban", tone: "bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300" },
  quote_sent: { icon: "money", tone: "bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300" },
  quote_accepted: { icon: "check", tone: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" },
  quote_declined: { icon: "close", tone: "bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300" },
  assignment_proposed: { icon: "truck", tone: "bg-flagred-600 text-white" },
  assignment_response: { icon: "user", tone: "bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300" },
  driver_assigned: { icon: "vehicle", tone: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" },
  shipment_confirmed: { icon: "check", tone: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" },
  shipment_started: { icon: "truck", tone: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300" },
  shipment_completed: { icon: "check", tone: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" },
  shipment_cancelled: { icon: "ban", tone: "bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300" },
  delivery_proved: { icon: "list", tone: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" },
  invoice_sent: { icon: "receipt", tone: "bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300" },
  internal_message: { icon: "chat", tone: "bg-navy-50 text-navy-700 dark:bg-white/10 dark:text-slate-200" },
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
    }
  | {
      mode: "notifications";
      notifications: AppNotification[];
    };

type Row = {
  id: string;
  icon: string;
  title: string;
  detail: string;
  time: string;
  tone: string;
  url?: string | null;
  unread?: boolean;
};

export default function AlertsFeed(props: Props) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const tables =
    props.mode === "notifications"
      ? ["notifications"]
      : ["shipment_events", "driver_assignments", "shipments"];
  const live = useLiveRefresh(tables, { pollMs: 6000 });

  const rows: Row[] = [];

  if (props.mode === "notifications") {
    for (const n of props.notifications) {
      const meta = NOTIFICATION_META[n.type] ?? {
        icon: "bell",
        tone: "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300",
      };
      rows.push({
        id: n.id,
        icon: meta.icon,
        title: n.title,
        detail: n.body ?? "",
        time: n.created_at,
        tone: meta.tone,
        url: n.url,
        unread: !n.read_at,
      });
    }
  } else if (props.mode === "driver") {
    const requestById = new Map(props.requests.map((r) => [r.id, r]));
    const shipmentById = new Map(props.shipments.map((s) => [s.id, s]));
    for (const a of props.assignments) {
      const s = shipmentById.get(a.shipment_id);
      const r = s ? requestById.get(s?.transport_request_id ?? "") : undefined;
      rows.push({
        id: a.id,
        icon: a.status === "proposed" ? "mail" : a.status === "completed" ? "check" : "truck",
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
      const meta = EVENT_META[e.event_type] ?? {
        icon: "bell",
        label: e.event_type,
        tone: "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300",
      };
      rows.push({ id: e.id, icon: meta.icon, title: meta.label, detail: "", time: e.created_at, tone: meta.tone });
    }
  }

  const unread = rows.filter((row) => row.unread).length;

  async function open(row: Row) {
    if (!row.unread) {
      if (row.url) router.push(row.url);
      return;
    }
    setBusyId(row.id);
    try {
      const supabase = createClient();
      await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("id", row.id);
    } finally {
      setBusyId(null);
    }
    if (row.url) router.push(row.url);
    else router.refresh();
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-navy-900 dark:text-slate-100">Alertes</h1>
          <p className="mt-0.5 text-xs text-slate-400">
            {rows.length > 0
              ? `${unread > 0 ? `${unread} non lue${unread > 1 ? "s" : ""} · ` : ""}dernier feed : ${relative(rows[0].time)}`
              : "Historique des notifications"}
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
          <NavIcon name="bell" className="mx-auto h-9 w-9 text-slate-300 dark:text-slate-500" />
          <p className="mt-3 font-display text-lg font-semibold text-navy-900 dark:text-slate-100">Aucune alerte</p>
          <p className="mx-auto mt-2 max-w-xs text-sm text-slate-400">
            Vous recevrez ici les notifications liées à vos dossiers et missions — activez les notifications navigateur dans Paramètres.
          </p>
        </div>
      ) : (
        <ul className="card-pro divide-y divide-slate-100 overflow-hidden dark:divide-white/5">
          {rows.map((row) => {
            const content = (
              <>
                <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl text-sm ${row.tone}`}>
                  <NavIcon name={row.icon as NavIconName} className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className={`truncate text-sm text-slate-800 dark:text-slate-200 ${row.unread ? "font-bold" : "font-semibold"}`}>
                    {row.title}
                  </p>
                  {row.detail && <p className="truncate text-xs text-slate-400">{row.detail}</p>}
                </div>
                {row.unread && <span className="h-2 w-2 shrink-0 rounded-full bg-flagred-600" aria-label="Non lue" />}
                <span className="shrink-0 text-right text-[11px] text-slate-400">{relative(row.time)}</span>
              </>
            );

            if (row.url) {
              return (
                <li key={row.id}>
                  <button
                    type="button"
                    onClick={() => void open(row)}
                    disabled={busyId === row.id}
                    className="flex w-full items-center gap-4 px-5 py-3.5 text-left transition-colors hover:bg-slate-50 disabled:opacity-60 dark:hover:bg-white/5"
                  >
                    {content}
                  </button>
                </li>
              );
            }
            return (
              <li key={row.id} className="flex items-center gap-4 px-5 py-3.5">
                {content}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
