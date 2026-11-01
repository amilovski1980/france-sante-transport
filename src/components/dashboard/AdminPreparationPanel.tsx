"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { recordPreparationProgress, setPreparationOrderStatus } from "@/lib/api";
import { toUserMessage } from "@/lib/errors";
import type {
  DeliverySchedule,
  DeliveryScheduleLine,
  Lot,
  PreparationOrder,
  PreparationOrderLine,
  Product,
  ProductReference,
  Recipient,
  Warehouse,
} from "@/lib/types";

const nf = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 });
const df = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" });

const STATUS_LABELS: Record<PreparationOrder["status"], string> = {
  pending: "En attente",
  preparing: "En préparation",
  ready: "Prête",
  cancelled: "Annulée",
};

const LINE_STATUS_LABELS: Record<PreparationOrderLine["status"], string> = {
  pending: "En attente",
  partial: "Partielle",
  prepared: "Prête",
};

const STATUS_TONES: Record<PreparationOrder["status"], string> = {
  pending: "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300",
  preparing: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  ready: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  cancelled: "bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-400",
};

const input =
  "w-24 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 outline-none focus:border-navy-400 dark:border-white/10 dark:bg-white/5 dark:text-slate-100";

export default function AdminPreparationPanel({
  orders,
  orderLines,
  schedules,
  scheduleLines,
  warehouses,
  recipients,
  lots,
  references,
  products,
}: {
  orders: PreparationOrder[];
  orderLines: PreparationOrderLine[];
  schedules: DeliverySchedule[];
  scheduleLines: DeliveryScheduleLine[];
  warehouses: Warehouse[];
  recipients: Recipient[];
  lots: Lot[];
  references: ProductReference[];
  products: Product[];
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const scheduleById = useMemo(() => new Map(schedules.map((schedule) => [schedule.id, schedule])), [schedules]);
  const scheduleLineById = useMemo(
    () => new Map(scheduleLines.map((line) => [line.id, line])),
    [scheduleLines],
  );
  const warehouseById = useMemo(() => new Map(warehouses.map((warehouse) => [warehouse.id, warehouse])), [warehouses]);
  const recipientById = useMemo(() => new Map(recipients.map((recipient) => [recipient.id, recipient])), [recipients]);
  const lotById = useMemo(() => new Map(lots.map((lot) => [lot.id, lot])), [lots]);
  const referenceById = useMemo(() => new Map(references.map((reference) => [reference.id, reference])), [references]);
  const productById = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);

  async function run(id: string, action: () => Promise<unknown>) {
    setBusyId(id);
    setError(null);
    try {
      await action();
      router.refresh();
    } catch (err) {
      setError(toUserMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  function progress(line: PreparationOrderLine) {
    const value = drafts[line.id];
    if (value !== undefined) return value;
    return String(line.quantity_prepared);
  }

  return (
    <div className="space-y-4">
      <div className="card-pro p-5">
        <h1 className="font-display text-xl font-bold text-navy-900 dark:text-white">Ordres de préparation</h1>
        <p className="mt-1 text-sm text-slate-400">
          Générez la préparation depuis un planning transmis, suivez l&apos;avancement puis marquez l&apos;ordre prêt.
        </p>
      </div>

      {error && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
          {error}
        </p>
      )}

      {orders.length === 0 && (
        <div className="card-pro p-8 text-center text-sm text-slate-400">
          Aucun ordre de préparation. Transmettez un planning fournisseur pour en générer.
        </div>
      )}

      {orders.map((order) => {
        const schedule = scheduleById.get(order.delivery_schedule_id);
        const lines = orderLines.filter((line) => line.preparation_order_id === order.id);
        const prepared = lines.filter((line) => line.status === "prepared").length;
        return (
          <section key={order.id} className="card-pro overflow-hidden">
            <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 dark:border-white/10 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-display text-base font-semibold text-navy-900 dark:text-white">
                    {schedule?.label || (schedule ? `Planning du ${df.format(new Date(schedule.requested_date))}` : "Planning")}
                  </h2>
                  <span className={`rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase ${STATUS_TONES[order.status]}`}>
                    {STATUS_LABELS[order.status]}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  {warehouseById.get(order.warehouse_id)?.name ?? "Entrepôt"} · {prepared}/{lines.length} ligne(s) prête(s)
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busyId === order.id || order.status === "ready" || order.status === "cancelled"}
                  onClick={() => run(order.id, () => setPreparationOrderStatus(order.id, "preparing"))}
                  className="rounded-xl bg-navy-800 px-3.5 py-2 text-xs font-semibold text-white hover:bg-navy-700 disabled:opacity-40"
                >
                  En préparation
                </button>
                <button
                  type="button"
                  disabled={busyId === order.id || order.status === "ready" || order.status === "cancelled"}
                  onClick={() => run(order.id, () => setPreparationOrderStatus(order.id, "ready"))}
                  className="rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-40"
                >
                  Marquer prête
                </button>
                <button
                  type="button"
                  disabled={busyId === order.id || order.status === "cancelled"}
                  onClick={() => run(order.id, () => setPreparationOrderStatus(order.id, "cancelled"))}
                  className="rounded-xl border border-red-200 px-3.5 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-40 dark:border-red-500/30 dark:hover:bg-red-500/10"
                >
                  Annuler
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="border-b border-slate-100 bg-slate-50/70 text-[11px] uppercase tracking-wide text-slate-400 dark:border-white/10 dark:bg-white/5">
                  <tr>
                    <th className="px-4 py-2.5">Destinataire</th>
                    <th className="px-4 py-2.5">Produit / lot</th>
                    <th className="px-4 py-2.5 text-right">À préparer</th>
                    <th className="px-4 py-2.5 text-right">Préparé</th>
                    <th className="px-4 py-2.5">Statut</th>
                    <th className="px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/10">
                  {lines.map((line) => {
                    const scheduleLine = scheduleLineById.get(line.schedule_line_id);
                    const lot = scheduleLine ? lotById.get(scheduleLine.lot_id) : undefined;
                    const reference = lot ? referenceById.get(lot.product_reference_id) : undefined;
                    const product = reference ? productById.get(reference.product_id) : undefined;
                    return (
                      <tr key={line.id}>
                        <td className="px-4 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200">
                          {scheduleLine ? recipientById.get(scheduleLine.recipient_id)?.name ?? "—" : "—"}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-slate-500">
                          {product?.name ?? "Produit"} · <span className="font-mono">{lot?.lot_number ?? "—"}</span>
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{nf.format(line.quantity_to_prepare)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{nf.format(line.quantity_prepared)}</td>
                        <td className="px-4 py-2.5">
                          <span className={`rounded-lg px-2 py-0.5 text-[10px] font-bold uppercase ${
                            line.status === "prepared"
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                              : line.status === "partial"
                                ? "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
                                : "bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-400"
                          }`}>
                            {LINE_STATUS_LABELS[line.status]}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center justify-end gap-2">
                            <input
                              className={input}
                              type="number"
                              min="0"
                              max={line.quantity_to_prepare}
                              step="0.001"
                              value={progress(line)}
                              onChange={(e) => setDrafts((current) => ({ ...current, [line.id]: e.target.value }))}
                            />
                            <button
                              type="button"
                              disabled={busyId === line.id || order.status === "cancelled"}
                              onClick={() =>
                                run(line.id, async () => {
                                  await recordPreparationProgress(line.id, Number(progress(line)));
                                  setDrafts((current) => {
                                    const next = { ...current };
                                    delete next[line.id];
                                    return next;
                                  });
                                })
                              }
                              className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/5"
                            >
                              OK
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {lines.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-6 text-center text-slate-400">Aucune ligne.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
    </div>
  );
}
