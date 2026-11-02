"use client";

import { useMemo, useState } from "react";
import type { DeliveryProof, DeliveryStatus } from "@/lib/types";
import type { SupplierWorkspace } from "@/lib/supplier-data";

const df = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" });

const STATUS_LABELS: Record<DeliveryStatus, string> = {
  pending: "En attente",
  scheduled: "Planifiée",
  in_progress: "En cours",
  delivered: "Livrée",
  failed: "Échec",
  cancelled: "Annulée",
};

const STATUS_TONES: Record<DeliveryStatus, string> = {
  pending: "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300",
  scheduled: "bg-navy-50 text-navy-700 dark:bg-white/10 dark:text-slate-200",
  in_progress: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  delivered: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  failed: "bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300",
  cancelled: "bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-400",
};

export default function SupplierDeliveriesPanel({ workspace }: { workspace: SupplierWorkspace }) {
  const { deliveries, recipients, schedules, proofs } = workspace;
  const [filter, setFilter] = useState<DeliveryStatus | "all">("all");
  const [proof, setProof] = useState<DeliveryProof | null>(null);

  const recipientById = useMemo(() => new Map(recipients.map((r) => [r.id, r])), [recipients]);
  const scheduleById = useMemo(() => new Map(schedules.map((s) => [s.id, s])), [schedules]);
  const proofByDelivery = useMemo(() => {
    const map = new Map<string, DeliveryProof>();
    for (const item of proofs) {
      if (item.delivery_id) map.set(item.delivery_id, item);
    }
    return map;
  }, [proofs]);

  const filtered = filter === "all" ? deliveries : deliveries.filter((d) => d.status === filter);

  return (
    <div className="space-y-4">
      <div className="card-pro flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-xl font-bold text-navy-900 dark:text-white">Livraisons</h1>
          <p className="mt-1 text-sm text-slate-400">{deliveries.length} livraison(s) au total</p>
        </div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as DeliveryStatus | "all")}
          className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm dark:border-white/10 dark:bg-white/5 dark:text-slate-100"
        >
          <option value="all">Tous les statuts</option>
          {(Object.keys(STATUS_LABELS) as DeliveryStatus[]).map((status) => (
            <option key={status} value={status}>{STATUS_LABELS[status]}</option>
          ))}
        </select>
      </div>

      <section className="card-pro overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50/70 text-[11px] uppercase tracking-wide text-slate-400 dark:border-white/10 dark:bg-white/5">
              <tr>
                <th className="px-4 py-3">Destinataire</th>
                <th className="px-4 py-3">Planning</th>
                <th className="px-4 py-3">Prévue</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3">Livrée le</th>
                <th className="px-4 py-3">Preuve</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/10">
              {filtered.map((delivery) => {
                const recipient = recipientById.get(delivery.recipient_id);
                const schedule = scheduleById.get(delivery.delivery_schedule_id);
                const item = proofByDelivery.get(delivery.id);
                return (
                  <tr key={delivery.id}>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-800 dark:text-slate-100">{recipient?.name ?? "—"}</p>
                      <p className="text-xs text-slate-400">{recipient?.city ?? recipient?.address ?? ""}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {schedule?.label || (schedule ? df.format(new Date(schedule.requested_date)) : "—")}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {delivery.scheduled_at ? df.format(new Date(delivery.scheduled_at)) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase ${STATUS_TONES[delivery.status]}`}>
                        {STATUS_LABELS[delivery.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {delivery.delivered_at ? df.format(new Date(delivery.delivered_at)) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {item ? (
                        <button
                          type="button"
                          onClick={() => setProof(item)}
                          className="text-xs font-semibold text-navy-700 underline decoration-navy-300 underline-offset-2 hover:text-navy-900 dark:text-slate-200"
                        >
                          Voir la signature
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400">Aucune livraison.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {proof && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl dark:bg-[#151a23]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-display text-base font-semibold text-navy-900 dark:text-white">Preuve de livraison</h3>
                <p className="mt-1 text-xs text-slate-400">
                  {proof.recipient_name} · {df.format(new Date(proof.created_at))}
                </p>
              </div>
              <button type="button" onClick={() => setProof(null)} className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-500 dark:border-white/10">
                Fermer
              </button>
            </div>
            <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-2 dark:border-white/10 dark:bg-white/5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={proof.signature_data} alt={`Signature de ${proof.recipient_name}`} className="h-auto w-full rounded-lg bg-white" />
            </div>
            {proof.note && <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:bg-white/5 dark:text-slate-300">{proof.note}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
