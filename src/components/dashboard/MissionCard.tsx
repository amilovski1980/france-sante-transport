"use client";

import { formatDateTime } from "@/components/dashboard/ClientDashboard";
import type { DriverAssignment, Shipment, TransportRequest } from "@/lib/types";

export default function MissionCard({ a, requestById, shipmentById, pendingId, respond }: { a: DriverAssignment; requestById: Map<string, TransportRequest>; shipmentById: Map<string, Shipment>; pendingId: string | null; respond: (id: string, accept: boolean) => void }) {
  const s = shipmentById.get(a.shipment_id);
  const r = s ? requestById.get(s.transport_request_id) : undefined;
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-600">{a.status === "proposed" ? "Nouvelle" : "En cours"}</span>
        {s && <span className="text-xs font-semibold text-slate-500">{formatDateTime(s.scheduled_at, "fr-FR")}</span>}
      </div>
      {r && <p className="mt-2 text-sm font-semibold text-slate-900">{r.pickup_address} → {r.dropoff_address}</p>}
      {a.status === "proposed" && (
        <div className="mt-3 flex gap-2">
          <button disabled={pendingId === a.id} onClick={() => respond(a.id, true)} className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white disabled:opacity-60">Accepter</button>
          <button disabled={pendingId === a.id} onClick={() => respond(a.id, false)} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-700 disabled:opacity-60">Refuser</button>
        </div>
      )}
    </div>
  );
}
