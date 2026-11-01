"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { respondToAssignment } from "@/lib/api";
import { toUserMessage } from "@/lib/errors";
import { useLiveRefresh } from "@/lib/useLiveRefresh";
import PositionShareToggle from "@/components/dashboard/PositionShareToggle";
import MissionCard from "@/components/dashboard/MissionCard";
import type { DriverAssignment, Profile, Shipment, TransportRequest, Vehicle } from "@/lib/types";

/**
 * Écran missions du chauffeur. La navigation (Missions · Alertes · Messages ·
 * Compte) est assurée par la BottomNav du layout : ce composant se concentre
 * sur les missions actives + le partage GPS.
 */
export default function DriverApp({
  driver,
  assignments,
  shipments,
  requests,
  vehicles,
}: {
  driver: Profile;
  assignments: DriverAssignment[];
  shipments: Shipment[];
  requests: TransportRequest[];
  vehicles: Vehicle[];
}) {
  const driverName = driver.full_name || driver.email;
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { mode } = useLiveRefresh(["driver_assignments", "shipments"]);
  const requestById = useMemo(() => new Map(requests.map((r) => [r.id, r])), [requests]);
  const shipmentById = useMemo(() => new Map(shipments.map((s) => [s.id, s])), [shipments]);
  const active = useMemo(() => assignments.filter((a) => a.status === "proposed" || a.status === "accepted").sort((a, b) => {
    const sa = shipmentById.get(a.shipment_id);
    const sb = shipmentById.get(b.shipment_id);
    return (sa?.scheduled_at ?? "").localeCompare(sb?.scheduled_at ?? "");
  }), [assignments, shipmentById]);
  const proposed = active.filter((a) => a.status === "proposed").length;

  async function respond(id: string, accept: boolean) {
    setPendingId(id);
    setError(null);
    try {
      await respondToAssignment(id, accept);
      router.refresh();
    } catch (err) {
      setError(toUserMessage(err));
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* Résumé du chauffeur */}
      <div className="card-pro overflow-hidden">
        <div className="flex items-center justify-between gap-4 px-5 py-4">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-flagred-600">Espace chauffeur</p>
            <h1 className="mt-0.5 font-display text-xl font-bold text-navy-900 dark:text-white">{driverName}</h1>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-400">
              <span
                className={`h-2 w-2 rounded-full ${
                  mode === "realtime" ? "animate-pulse bg-emerald-500" : mode === "connecting" ? "animate-pulse bg-navy-400" : "bg-amber-500"
                }`}
              />
              {mode === "realtime" ? "Synchro temps réel" : mode === "connecting" ? "Connexion…" : "Mise à jour périodique"}
            </p>
          </div>
          {proposed > 0 ? (
            <span className="shrink-0 rounded-xl bg-flagred-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm">
              {proposed} {proposed > 1 ? "propositions" : "proposition"}
            </span>
          ) : (
            <span className="shrink-0 rounded-xl bg-emerald-50 px-3.5 py-2 text-xs font-bold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
              À jour
            </span>
          )}
        </div>
      </div>

      {error && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
          {error}
        </p>
      )}

      <PositionShareToggle />

      {active.length === 0 ? (
        <div className="card-pro p-10 text-center">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="mx-auto h-10 w-10 text-slate-300 dark:text-slate-600"><rect x="1" y="4" width="14" height="11" rx="1"/><path d="M15 8h4l3 3v4h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
          <p className="mt-3 font-display text-lg font-semibold text-navy-900 dark:text-slate-100">Aucune mission active</p>
          <p className="mx-auto mt-2 max-w-xs text-sm text-slate-400">
            Les nouvelles missions proposées par le dispatch apparaîtront ici en temps réel, avec une notification push.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {active.map((a) => (
            <MissionCard
              key={a.id}
              a={a}
              requestById={requestById}
              shipmentById={shipmentById}
              pendingId={pendingId}
              respond={respond}
              vehicles={vehicles}
            />
          ))}
        </div>
      )}
    </div>
  );
}
