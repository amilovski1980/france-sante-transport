"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { convertPickupOrderToSchedule, setPickupOrderStatus } from "@/lib/api";
import { toUserMessage } from "@/lib/errors";
import type {
  Lot,
  PickupOrder,
  PickupOrderLine,
  PickupOrderStatus,
  Product,
  ProductReference,
  Recipient,
  Supplier,
  Warehouse,
} from "@/lib/types";

const nf = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 });
const df = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" });

const STATUS_LABELS: Record<PickupOrderStatus, string> = {
  submitted: "Envoyée",
  confirmed: "Confirmée",
  planned: "Planifiée",
  completed: "Terminée",
  cancelled: "Annulée",
};

const STATUS_TONES: Record<PickupOrderStatus, string> = {
  submitted: "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
  confirmed: "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300",
  planned: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  completed: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  cancelled: "bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-400",
};

function statusRank(status: PickupOrderStatus) {
  return status === "submitted" ? 0 : status === "confirmed" ? 1 : status === "planned" ? 2 : 3;
}

export default function AdminPickupsPanel({
  orders,
  lines,
  suppliers,
  warehouses,
  recipients,
  lots,
  references,
  products,
}: {
  orders: PickupOrder[];
  lines: PickupOrderLine[];
  suppliers: Supplier[];
  warehouses: Warehouse[];
  recipients: Recipient[];
  lots: Lot[];
  references: ProductReference[];
  products: Product[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [filter, setFilter] = useState<PickupOrderStatus | "all">("all");
  const [selectedId, setSelectedId] = useState<string | null>(orders[0]?.id ?? null);
  const [adminNotes, setAdminNotes] = useState("");

  const supplierById = useMemo(() => new Map(suppliers.map((s) => [s.id, s])), [suppliers]);
  const warehouseById = useMemo(() => new Map(warehouses.map((w) => [w.id, w])), [warehouses]);
  const recipientById = useMemo(() => new Map(recipients.map((r) => [r.id, r])), [recipients]);
  const lotById = useMemo(() => new Map(lots.map((l) => [l.id, l])), [lots]);
  const referenceById = useMemo(() => new Map(references.map((r) => [r.id, r])), [references]);
  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const counts = useMemo(() => {
    const result: Record<PickupOrderStatus, number> = {
      submitted: 0,
      confirmed: 0,
      planned: 0,
      completed: 0,
      cancelled: 0,
    };
    for (const order of orders) result[order.status] += 1;
    return result;
  }, [orders]);

  const filtered = (filter === "all" ? orders : orders.filter((order) => order.status === filter))
    .slice()
    .sort((a, b) => {
      const rank = statusRank(a.status) - statusRank(b.status);
      if (rank !== 0) return rank;
      return b.requested_pickup_date.localeCompare(a.requested_pickup_date);
    });

  const selected = orders.find((order) => order.id === selectedId) ?? null;
  const selectedLines = selected ? lines.filter((line) => line.pickup_order_id === selected.id) : [];

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      await action();
      router.refresh();
    } catch (err) {
      setError(toUserMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function updateStatus(status: PickupOrderStatus) {
    if (!selected) return;
    await run(async () => {
      await setPickupOrderStatus(selected.id, status, adminNotes.trim() || null);
      setAdminNotes("");
    });
  }

  async function convert() {
    if (!selected) return;
    await run(async () => {
      const schedule = await convertPickupOrderToSchedule(selected.id);
      setInfo(`Planning créé : ${schedule.label ?? schedule.id}`);
    });
  }

  return (
    <div className="space-y-4">
      <div className="card-pro p-5">
        <h1 className="font-display text-xl font-bold text-navy-900 dark:text-white">Commandes d&apos;enlèvement</h1>
        <p className="mt-1 text-sm text-slate-400">
          Commandes envoyées par les fournisseurs. Confirmez, renseignez une réponse puis convertissez en planning de livraison.
        </p>
      </div>

      {error && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
          {error}
        </p>
      )}
      {info && (
        <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
          {info}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {(["submitted", "confirmed", "planned", "completed", "cancelled"] as PickupOrderStatus[]).map((status) => (
          <div key={status} className="card-pro px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{STATUS_LABELS[status]}</p>
            <p className="mt-1 font-display text-2xl font-bold tabular-nums text-navy-900 dark:text-white">{counts[status]}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_1.3fr]">
        <section className="card-pro overflow-hidden">
          <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-100 px-4 py-3 dark:border-white/10">
            <button
              type="button"
              onClick={() => setFilter("all")}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${filter === "all" ? "bg-navy-800 text-white" : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/5"}`}
            >
              Toutes ({orders.length})
            </button>
            {(["submitted", "confirmed", "planned"] as PickupOrderStatus[]).map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setFilter(status)}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${filter === status ? "bg-navy-800 text-white" : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/5"}`}
              >
                {STATUS_LABELS[status]} ({counts[status]})
              </button>
            ))}
          </div>
          <ul className="divide-y divide-slate-100 dark:divide-white/10">
            {filtered.map((order) => {
              const count = lines.filter((line) => line.pickup_order_id === order.id).length;
              return (
                <li key={order.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedId(order.id);
                      setAdminNotes(order.admin_notes ?? "");
                    }}
                    className={`flex w-full items-center justify-between gap-3 px-5 py-3 text-left transition ${
                      selectedId === order.id ? "bg-navy-50/70 dark:bg-white/5" : "hover:bg-slate-50 dark:hover:bg-white/5"
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-navy-900 dark:text-slate-100">
                        {supplierById.get(order.supplier_id)?.code ?? "Fournisseur"} · {df.format(new Date(order.requested_pickup_date))}
                      </p>
                      <p className="truncate text-xs text-slate-400">
                        {warehouseById.get(order.warehouse_id)?.name ?? "Entrepôt"} · {count} ligne(s)
                      </p>
                    </div>
                    <span className={`shrink-0 rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase ${STATUS_TONES[order.status]}`}>
                      {STATUS_LABELS[order.status]}
                    </span>
                  </button>
                </li>
              );
            })}
            {filtered.length === 0 && (
              <li className="px-5 py-8 text-center text-sm text-slate-400">Aucune commande.</li>
            )}
          </ul>
        </section>

        <section className="card-pro overflow-hidden">
          {!selected ? (
            <p className="p-8 text-center text-sm text-slate-400">Sélectionnez une commande.</p>
          ) : (
            <>
              <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 dark:border-white/10 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="font-display text-base font-semibold text-navy-900 dark:text-white">
                    {supplierById.get(selected.supplier_id)?.code ?? "Fournisseur"}
                  </h2>
                  <p className="mt-1 text-xs text-slate-400">
                    {df.format(new Date(selected.requested_pickup_date))}
                    {selected.requested_window ? ` · ${selected.requested_window}` : ""} ·{" "}
                    {warehouseById.get(selected.warehouse_id)?.name ?? "Entrepôt"}
                  </p>
                </div>
                <span className={`w-fit rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase ${STATUS_TONES[selected.status]}`}>
                  {STATUS_LABELS[selected.status]}
                </span>
              </div>

              <div className="space-y-2 border-b border-slate-100 px-5 py-4 text-xs text-slate-500 dark:border-white/10 dark:text-slate-400">
                <p className="font-semibold text-slate-700 dark:text-slate-200">{selected.pickup_address}</p>
                {selected.pickup_contact_name && <p>Contact : {selected.pickup_contact_name}</p>}
                {selected.pickup_contact_phone && <p>Téléphone : {selected.pickup_contact_phone}</p>}
                {selected.notes && <p>Consignes fournisseur : {selected.notes}</p>}
                {selected.admin_notes && (
                  <p className="rounded-lg bg-amber-50 px-3 py-2 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                    Réponse FST : {selected.admin_notes}
                  </p>
                )}
                {selected.delivery_schedule_id && (
                  <p>Planning lié : <span className="font-mono">{selected.delivery_schedule_id}</span></p>
                )}
              </div>

              <div className="border-b border-slate-100 px-5 py-4 dark:border-white/10">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-400" htmlFor="admin-notes">
                  Réponse au fournisseur
                </label>
                <textarea
                  id="admin-notes"
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-navy-400 dark:border-white/10 dark:bg-white/5 dark:text-slate-100"
                  rows={2}
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Créneau confirmé, consignes, motif d'annulation…"
                />
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy || selected.status !== "submitted"}
                    onClick={() => updateStatus("confirmed")}
                    className="rounded-xl bg-navy-800 px-3.5 py-2 text-xs font-semibold text-white hover:bg-navy-700 disabled:opacity-40"
                  >
                    Confirmer
                  </button>
                  <button
                    type="button"
                    disabled={busy || !["submitted", "confirmed"].includes(selected.status)}
                    onClick={convert}
                    className="rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-40"
                  >
                    Convertir en planning
                  </button>
                  <button
                    type="button"
                    disabled={busy || !["confirmed", "planned"].includes(selected.status)}
                    onClick={() => updateStatus("completed")}
                    className="rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
                  >
                    Marquer terminée
                  </button>
                  <button
                    type="button"
                    disabled={busy || ["completed", "cancelled"].includes(selected.status)}
                    onClick={() => updateStatus("cancelled")}
                    className="rounded-xl border border-red-200 px-3.5 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-40 dark:border-red-500/30 dark:hover:bg-red-500/10"
                  >
                    Annuler
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-left text-sm">
                  <thead className="border-b border-slate-100 bg-slate-50/70 text-[11px] uppercase tracking-wide text-slate-400 dark:border-white/10 dark:bg-white/5">
                    <tr>
                      <th className="px-4 py-2.5">Destinataire</th>
                      <th className="px-4 py-2.5">Lot</th>
                      <th className="px-4 py-2.5 text-right">Quantité</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/10">
                    {selectedLines.map((line) => {
                      const lot = lotById.get(line.lot_id);
                      const reference = lot ? referenceById.get(lot.product_reference_id) : undefined;
                      const product = reference ? productById.get(reference.product_id) : undefined;
                      return (
                        <tr key={line.id}>
                          <td className="px-4 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200">
                            {recipientById.get(line.recipient_id)?.name ?? "Destinataire"}
                          </td>
                          <td className="px-4 py-2.5 text-xs text-slate-500">
                            {product?.name ?? "Produit"} · <span className="font-mono">{lot?.lot_number ?? "—"}</span>
                          </td>
                          <td className="px-4 py-2.5 text-right text-xs tabular-nums">
                            {nf.format(line.quantity)} {line.unit ?? product?.unit ?? ""}
                          </td>
                        </tr>
                      );
                    })}
                    {selectedLines.length === 0 && (
                      <tr>
                        <td colSpan={3} className="px-4 py-6 text-center text-slate-400">Aucune ligne.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
