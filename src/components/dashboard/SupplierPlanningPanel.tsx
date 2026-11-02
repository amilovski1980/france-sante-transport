"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  addDeliveryScheduleLine,
  cancelDeliverySchedule,
  createDeliverySchedule,
  deleteDeliverySchedule,
  removeDeliveryScheduleLine,
  transmitDeliverySchedule,
  validateDeliverySchedule,
} from "@/lib/api";
import { toUserMessage } from "@/lib/errors";
import type { DeliverySchedule } from "@/lib/types";
import type { SupplierWorkspace } from "@/lib/supplier-data";

const nf = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 });
const df = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" });

const input =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-navy-400 dark:border-white/10 dark:bg-white/5 dark:text-slate-100";

const STATUS_LABELS: Record<DeliverySchedule["status"], string> = {
  draft: "Brouillon",
  validated: "Validé",
  transmitted: "Transmis",
  planned: "Planifié",
  in_progress: "En cours",
  completed: "Terminé",
  cancelled: "Annulé",
};

const STATUS_TONES: Record<DeliverySchedule["status"], string> = {
  draft: "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300",
  validated: "bg-navy-50 text-navy-700 dark:bg-white/10 dark:text-slate-200",
  transmitted: "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300",
  planned: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  in_progress: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  completed: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  cancelled: "bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-400",
};

function tomorrow() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return date.toISOString().slice(0, 10);
}

export default function SupplierPlanningPanel({ workspace }: { workspace: SupplierWorkspace }) {
  const { supplier, warehouses, schedules, scheduleLines, recipients, lots, references, products, stockLevels } = workspace;
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(schedules[0]?.id ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createDraft, setCreateDraft] = useState({
    warehouse_id: warehouses[0]?.id ?? "",
    requested_date: tomorrow(),
    label: "",
    notes: "",
  });
  const [lineDraft, setLineDraft] = useState({
    recipient_id: recipients[0]?.id ?? "",
    lot_id: lots[0]?.id ?? "",
    quantity: "",
    unit: "",
    notes: "",
  });

  const referenceById = useMemo(() => new Map(references.map((r) => [r.id, r])), [references]);
  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const recipientById = useMemo(() => new Map(recipients.map((r) => [r.id, r])), [recipients]);
  const warehouseById = useMemo(() => new Map(warehouses.map((w) => [w.id, w])), [warehouses]);
  const availableByLot = useMemo(() => {
    const map = new Map<string, number>();
    for (const level of stockLevels) {
      map.set(
        level.lot_id,
        (map.get(level.lot_id) ?? 0) + Math.max(0, level.qty_on_hand - level.qty_reserved - level.qty_shipped),
      );
    }
    return map;
  }, [stockLevels]);

  const selected = schedules.find((s) => s.id === selectedId) ?? null;
  const lines = selected ? scheduleLines.filter((line) => line.delivery_schedule_id === selected.id) : [];

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      router.refresh();
    } catch (err) {
      setError(toUserMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function submitCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!supplier) return;
    await run(async () => {
      const schedule = await createDeliverySchedule({
        supplier_id: supplier.id,
        warehouse_id: createDraft.warehouse_id,
        requested_date: createDraft.requested_date,
        label: createDraft.label.trim() || null,
        notes: createDraft.notes.trim() || null,
      });
      setSelectedId(schedule.id);
      setCreateDraft((d) => ({ ...d, label: "", notes: "" }));
    });
  }

  async function submitLine(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    await run(async () => {
      await addDeliveryScheduleLine({
        schedule_id: selected.id,
        recipient_id: lineDraft.recipient_id,
        lot_id: lineDraft.lot_id,
        quantity: Number(lineDraft.quantity),
        unit: lineDraft.unit.trim() || null,
        notes: lineDraft.notes.trim() || null,
      });
      setLineDraft((d) => ({ ...d, quantity: "", notes: "" }));
    });
  }

  if (!supplier) {
    return <p className="surface p-6 text-sm text-slate-500">Aucun fournisseur rattaché à votre compte.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="card-pro p-5">
        <h1 className="font-display text-xl font-bold text-navy-900 dark:text-white">Plannings de livraison</h1>
        <p className="mt-1 text-sm text-slate-400">
          Préparez les lots par destinataire, validez la réservation de stock puis transmettez le planning.
        </p>
      </div>

      {error && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
          {error}
        </p>
      )}

      <div className="grid gap-4 xl:grid-cols-[1.1fr_1.4fr]">
        <div className="space-y-4">
          <section className="card-pro overflow-hidden">
            <div className="border-b border-slate-100 px-5 py-3.5 dark:border-white/10">
              <h2 className="font-display text-sm font-semibold text-navy-900 dark:text-white">Plannings existants</h2>
            </div>
            <ul className="divide-y divide-slate-100 dark:divide-white/10">
              {schedules.map((schedule) => {
                const count = scheduleLines.filter((line) => line.delivery_schedule_id === schedule.id).length;
                return (
                  <li key={schedule.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(schedule.id)}
                      className={`flex w-full items-center justify-between gap-3 px-5 py-3 text-left transition ${
                        selectedId === schedule.id ? "bg-navy-50/70 dark:bg-white/5" : "hover:bg-slate-50 dark:hover:bg-white/5"
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-navy-900 dark:text-slate-100">
                          {schedule.label || `Planning du ${df.format(new Date(schedule.requested_date))}`}
                        </p>
                        <p className="text-xs text-slate-400">
                          {warehouseById.get(schedule.warehouse_id)?.name ?? "Entrepôt"} · {count} ligne(s)
                        </p>
                      </div>
                      <span className={`shrink-0 rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase ${STATUS_TONES[schedule.status]}`}>
                        {STATUS_LABELS[schedule.status]}
                      </span>
                    </button>
                  </li>
                );
              })}
              {schedules.length === 0 && (
                <li className="px-5 py-8 text-center text-sm text-slate-400">Aucun planning.</li>
              )}
            </ul>
          </section>

          <section className="card-pro p-5">
            <h2 className="font-display text-sm font-semibold text-navy-900 dark:text-white">Nouveau planning</h2>
            <form onSubmit={submitCreate} className="mt-3 space-y-2">
              <select className={input} value={createDraft.warehouse_id} onChange={(e) => setCreateDraft({ ...createDraft, warehouse_id: e.target.value })} required>
                <option value="">Entrepôt *</option>
                {warehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>
                ))}
              </select>
              <input className={input} type="date" value={createDraft.requested_date} onChange={(e) => setCreateDraft({ ...createDraft, requested_date: e.target.value })} required />
              <input className={input} placeholder="Libellé (ex. Tournée Nord)" value={createDraft.label} onChange={(e) => setCreateDraft({ ...createDraft, label: e.target.value })} />
              <input className={input} placeholder="Notes" value={createDraft.notes} onChange={(e) => setCreateDraft({ ...createDraft, notes: e.target.value })} />
              <button type="submit" disabled={busy} className="rounded-xl bg-navy-800 px-4 py-2 text-xs font-semibold text-white hover:bg-navy-700 disabled:opacity-60">
                Créer le planning
              </button>
            </form>
          </section>
        </div>

        <section className="card-pro overflow-hidden">
          {!selected ? (
            <p className="p-8 text-center text-sm text-slate-400">Sélectionnez un planning.</p>
          ) : (
            <>
              <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 dark:border-white/10 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="font-display text-base font-semibold text-navy-900 dark:text-white">
                    {selected.label || `Planning du ${df.format(new Date(selected.requested_date))}`}
                  </h2>
                  <p className="mt-1 text-xs text-slate-400">
                    {warehouseById.get(selected.warehouse_id)?.name ?? "Entrepôt"} · {df.format(new Date(selected.requested_date))}
                  </p>
                </div>
                <span className={`w-fit rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase ${STATUS_TONES[selected.status]}`}>
                  {STATUS_LABELS[selected.status]}
                </span>
              </div>

              <div className="flex flex-wrap gap-2 border-b border-slate-100 px-5 py-3 dark:border-white/10">
                <button
                  type="button"
                  disabled={busy || selected.status !== "draft"}
                  onClick={() => run(() => validateDeliverySchedule(selected.id))}
                  className="rounded-xl bg-navy-800 px-3.5 py-2 text-xs font-semibold text-white hover:bg-navy-700 disabled:opacity-40"
                >
                  Valider
                </button>
                <button
                  type="button"
                  disabled={busy || selected.status !== "validated"}
                  onClick={() => run(() => transmitDeliverySchedule(selected.id))}
                  className="rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-40"
                >
                  Transmettre
                </button>
                <button
                  type="button"
                  disabled={busy || ["cancelled", "completed"].includes(selected.status)}
                  onClick={() => run(() => cancelDeliverySchedule(selected.id))}
                  className="rounded-xl border border-red-200 px-3.5 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-40 dark:border-red-500/30 dark:hover:bg-red-500/10"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  disabled={busy || selected.status !== "draft"}
                  onClick={() => run(async () => {
                    await deleteDeliverySchedule(selected.id);
                    setSelectedId(null);
                  })}
                  className="rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
                >
                  Supprimer
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-left text-sm">
                  <thead className="border-b border-slate-100 bg-slate-50/70 text-[11px] uppercase tracking-wide text-slate-400 dark:border-white/10 dark:bg-white/5">
                    <tr>
                      <th className="px-4 py-2.5">Destinataire</th>
                      <th className="px-4 py-2.5">Lot</th>
                      <th className="px-4 py-2.5 text-right">Quantité</th>
                      <th className="px-4 py-2.5" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/10">
                    {lines.map((line) => {
                      const lot = lots.find((l) => l.id === line.lot_id);
                      const reference = lot ? referenceById.get(lot.product_reference_id) : undefined;
                      const product = reference ? productById.get(reference.product_id) : undefined;
                      return (
                        <tr key={line.id}>
                          <td className="px-4 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200">
                            {recipientById.get(line.recipient_id)?.name ?? "—"}
                          </td>
                          <td className="px-4 py-2.5 text-xs text-slate-500">
                            {product?.name ?? "Produit"} · <span className="font-mono">{lot?.lot_number ?? "—"}</span>
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums">
                            {nf.format(line.quantity)} {line.unit ?? product?.unit ?? ""}
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <button
                              type="button"
                              disabled={busy || selected.status !== "draft"}
                              onClick={() => run(() => removeDeliveryScheduleLine(line.id))}
                              className="text-xs font-semibold text-red-600 hover:underline disabled:opacity-40"
                            >
                              Retirer
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {lines.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-4 py-6 text-center text-slate-400">Aucune ligne.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {selected.status === "draft" && (
                <form onSubmit={submitLine} className="space-y-2 border-t border-slate-100 p-4 dark:border-white/10">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Ajouter une ligne</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <select className={input} value={lineDraft.recipient_id} onChange={(e) => setLineDraft({ ...lineDraft, recipient_id: e.target.value })} required>
                      <option value="">Destinataire *</option>
                      {recipients.map((recipient) => (
                        <option key={recipient.id} value={recipient.id}>{recipient.name}</option>
                      ))}
                    </select>
                    <select className={input} value={lineDraft.lot_id} onChange={(e) => setLineDraft({ ...lineDraft, lot_id: e.target.value })} required>
                      <option value="">Lot *</option>
                      {lots.map((lot) => {
                        const reference = referenceById.get(lot.product_reference_id);
                        const product = reference ? productById.get(reference.product_id) : undefined;
                        return (
                          <option key={lot.id} value={lot.id}>
                            {product?.name ?? "Produit"} · {lot.lot_number} ({nf.format(availableByLot.get(lot.id) ?? 0)} dispo)
                          </option>
                        );
                      })}
                    </select>
                    <input className={input} type="number" min="0.001" step="0.001" placeholder="Quantité *" value={lineDraft.quantity} onChange={(e) => setLineDraft({ ...lineDraft, quantity: e.target.value })} required />
                    <input className={input} placeholder="Unité" value={lineDraft.unit} onChange={(e) => setLineDraft({ ...lineDraft, unit: e.target.value })} />
                  </div>
                  <button type="submit" disabled={busy} className="rounded-xl bg-navy-800 px-4 py-2 text-xs font-semibold text-white hover:bg-navy-700 disabled:opacity-60">
                    Ajouter
                  </button>
                </form>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
