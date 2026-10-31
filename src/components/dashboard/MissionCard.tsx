"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import DeliveryValidation from "@/components/dashboard/DeliveryValidation";
import { formatDateTime } from "@/components/dashboard/ClientDashboard";
import type { DriverAssignment, Shipment, TransportRequest, Vehicle } from "@/lib/types";

const PHASE_STEPS = [
  { key: "confirmed", label: "Confirmée" },
  { key: "in_progress", label: "En course" },
  { key: "completed", label: "Terminée" },
] as const;

export default function MissionCard({
  a,
  requestById,
  shipmentById,
  pendingId,
  respond,
  vehicles = [],
}: {
  a: DriverAssignment;
  requestById: Map<string, TransportRequest>;
  shipmentById: Map<string, Shipment>;
  pendingId: string | null;
  respond: (id: string, accept: boolean) => void;
  vehicles?: Vehicle[];
}) {
  const s = shipmentById.get(a.shipment_id);
  const r = s ? requestById.get(s.transport_request_id) : undefined;
  const vehicle = vehicles.find((v) => v.id === a.vehicle_id);
  const proposed = a.status === "proposed";
  const router = useRouter();
  const [podOpen, setPodOpen] = useState(false);
  const currentStep = s?.status === "completed" ? 2 : s?.status === "in_progress" ? 1 : 0;
  const deliverable = !proposed && a.status === "accepted" && s && (s.status === "confirmed" || s.status === "in_progress");

  return (
    <div className="card-pro overflow-hidden">
      {/* En-tête mission */}
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3.5 dark:border-white/10">
        <span
          className={`rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
            proposed
              ? "bg-flagred-600 text-white"
              : currentStep === 2
                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                : "bg-navy-50 text-navy-700 dark:bg-white/10 dark:text-slate-200"
          }`}
        >
          {proposed ? "Nouvelle mission" : currentStep === 2 ? "Terminée" : currentStep === 1 ? "En course" : "Confirmée"}
        </span>
        {s && <span className="text-xs font-semibold text-slate-500">{formatDateTime(s.scheduled_at, "fr-FR")}</span>}
      </div>

      <div className="px-5 py-4">
        {r ? (
          <div className="space-y-2.5">
            <div className="flex items-start gap-2.5">
              <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-emerald-100 text-[10px] font-bold text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">A</span>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{r.pickup_address}</p>
            </div>
            <div className="flex items-start gap-2.5">
              <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-navy-100 text-[10px] font-bold text-navy-700 dark:bg-white/10 dark:text-slate-200">B</span>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{r.dropoff_address}</p>
            </div>
          </div>
        ) : (
          <p className="text-sm italic text-slate-400">Détails de la mission à venir…</p>
        )}

        {(r?.patient_name || r?.mobility_notes || vehicle) && (
          <div className="mt-3 rounded-xl bg-slate-50 px-3.5 py-2.5 text-xs leading-relaxed text-slate-600 dark:bg-white/5 dark:text-slate-300">
            {r?.patient_name && <p><span className="font-semibold">Patient :</span> {r.patient_name}</p>}
            {r?.mobility_notes && <p><span className="font-semibold">Mobilité :</span> {r.mobility_notes}</p>}
            {vehicle && <p><span className="font-semibold">Véhicule :</span> {vehicle.label || vehicle.registration_plate} · {vehicle.registration_plate}</p>}
          </div>
        )}
      </div>

      {/* Progression phase (missions confirmées et au-delà) */}
      {!proposed && s && (
        <div className="flex items-center gap-1.5 px-5 pb-3">
          {PHASE_STEPS.map((step, i) => (
            <div key={step.key} className="flex flex-1 items-center gap-1.5">
              <span
                className={`h-1.5 flex-1 rounded-full transition-colors duration-500 ${
                  i <= currentStep ? "bg-emerald-500" : "bg-slate-200 dark:bg-white/10"
                }`}
              />
            </div>
          ))}
          <span className="w-full text-right text-[10px] font-semibold text-slate-400">{PHASE_STEPS[currentStep].label}</span>
        </div>
      )}

      {proposed && (
        <div className="flex gap-2 border-t border-slate-100 px-5 py-3 dark:border-white/10">
          <button
            type="button"
            disabled={pendingId === a.id}
            onClick={() => respond(a.id, true)}
            className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
          >
            {pendingId === a.id ? "…" : "✓ Accepter"}
          </button>
          <button
            type="button"
            disabled={pendingId === a.id}
            onClick={() => respond(a.id, false)}
            className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/5"
          >
            Refuser
          </button>
        </div>
      )}

      {!proposed && s && (
        <div className="flex gap-2 border-t border-slate-100 px-5 py-3 dark:border-white/10">
          <Link
            href={`/dashboard/labels/${s.id}`}
            target="_blank"
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-navy-700 transition hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/5"
          >
            🏷️ Étiquette
          </Link>
          {deliverable && (
            <button
              type="button"
              onClick={() => setPodOpen(true)}
              className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700"
            >
              ✅ Valider la livraison
            </button>
          )}
          {s?.status === "completed" && (
            <span className="flex-1 rounded-xl bg-emerald-50 py-2.5 text-center text-sm font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
              ✓ Livraison validée
            </span>
          )}
        </div>
      )}

      {podOpen && s && (
        <DeliveryValidation
          shipment={s}
          request={r ?? null}
          onClose={() => setPodOpen(false)}
          onConfirmed={() => {
            setPodOpen(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
