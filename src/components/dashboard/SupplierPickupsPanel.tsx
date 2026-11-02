"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createPickupOrder } from "@/lib/api";
import { toUserMessage } from "@/lib/errors";
import type { PickupOrder } from "@/lib/types";
import type { SupplierWorkspace } from "@/lib/supplier-data";

const nf = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 });
const df = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" });

const input =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-navy-400 dark:border-white/10 dark:bg-white/5 dark:text-slate-100";

const STATUS_LABELS: Record<PickupOrder["status"], string> = {
  submitted: "Envoyée",
  confirmed: "Confirmée",
  planned: "Planifiée",
  completed: "Terminée",
  cancelled: "Annulée",
};

const STATUS_TONES: Record<PickupOrder["status"], string> = {
  submitted: "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
  confirmed: "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300",
  planned: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  completed: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  cancelled: "bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-400",
};

type LineDraft = {
  recipient_id: string;
  lot_id: string;
  quantity: string;
  unit: string;
  notes: string;
};

function tomorrow() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return date.toISOString().slice(0, 10);
}

export default function SupplierPickupsPanel({ workspace }: { workspace: SupplierWorkspace }) {
  const { supplier, warehouses, recipients, lots, references, products, pickupOrders, pickupOrderLines } = workspace;
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(pickupOrders[0]?.id ?? null);
  const [orderDraft, setOrderDraft] = useState({
    warehouse_id: warehouses[0]?.id ?? "",
    pickup_address: "",
    requested_pickup_date: tomorrow(),
    requested_window: "",
    contact_name: "",
    contact_phone: "",
    notes: "",
  });
  const [lineDraft, setLineDraft] = useState<LineDraft>({
    recipient_id: recipients[0]?.id ?? "",
    lot_id: lots.find((lot) => lot.warehouse_id === warehouses[0]?.id)?.id ?? "",
    quantity: "",
    unit: "",
    notes: "",
  });
  const [draftLines, setDraftLines] = useState<LineDraft[]>([]);

  const referenceById = useMemo(() => new Map(references.map((r) => [r.id, r])), [references]);
  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const recipientById = useMemo(() => new Map(recipients.map((r) => [r.id, r])), [recipients]);
  const warehouseById = useMemo(() => new Map(warehouses.map((w) => [w.id, w])), [warehouses]);
  const warehouseLots = useMemo(
    () => lots.filter((lot) => lot.warehouse_id === orderDraft.warehouse_id),
    [lots, orderDraft.warehouse_id],
  );

  const selected = pickupOrders.find((order) => order.id === selectedId) ?? null;
  const lines = selected ? pickupOrderLines.filter((line) => line.pickup_order_id === selected.id) : [];

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

  function addLine(e: React.FormEvent) {
    e.preventDefault();
    if (!lineDraft.recipient_id || !lineDraft.lot_id || !lineDraft.quantity) return;
    setDraftLines((current) => [...current, lineDraft]);
    setLineDraft((current) => ({ ...current, quantity: "", notes: "" }));
  }

  async function submitOrder(e: React.FormEvent) {
    e.preventDefault();
    if (!supplier) return;
    if (draftLines.length === 0) {
      setError("Ajoutez au moins une ligne à la commande.");
      return;
    }
    await run(async () => {
      const order = await createPickupOrder({
        supplier_id: supplier.id,
        warehouse_id: orderDraft.warehouse_id,
        pickup_address: orderDraft.pickup_address.trim(),
        requested_pickup_date: orderDraft.requested_pickup_date,
        requested_window: orderDraft.requested_window.trim() || null,
        contact_name: orderDraft.contact_name.trim() || null,
        contact_phone: orderDraft.contact_phone.trim() || null,
        notes: orderDraft.notes.trim() || null,
        lines: draftLines.map((line) => ({
          recipient_id: line.recipient_id,
          product_reference_id:
            lots.find((lot) => lot.id === line.lot_id)?.product_reference_id ?? "",
          lot_id: line.lot_id,
          quantity: Number(line.quantity),
          unit: line.unit.trim() || null,
          notes: line.notes.trim() || null,
        })),
      });
      setSelectedId(order.id);
      setDraftLines([]);
      setOrderDraft((current) => ({ ...current, notes: "", pickup_address: "" }));
    });
  }

  if (!supplier) {
    return <p className="surface p-6 text-sm text-slate-500">Aucun fournisseur rattaché à votre compte.</p>;
  }

  const defaultAddress = warehouseById.get(orderDraft.warehouse_id)?.address ?? "";

  return (
    <div className="space-y-4">
      <div className="card-pro p-5">
        <h1 className="font-display text-xl font-bold text-navy-900 dark:text-white">Commandes d&apos;enlèvement</h1>
        <p className="mt-1 text-sm text-slate-400">
          Déclarez les lots à enlever et leurs destinataires. France Santé Transport confirme et planifie l&apos;enlèvement.
        </p>
      </div>

      {error && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
          {error}
        </p>
      )}

      <div className="grid gap-4 xl:grid-cols-[1fr_1.2fr]">
        <div className="space-y-4">
          <section className="card-pro overflow-hidden">
            <div className="border-b border-slate-100 px-5 py-3.5 dark:border-white/10">
              <h2 className="font-display text-sm font-semibold text-navy-900 dark:text-white">Mes commandes</h2>
            </div>
            <ul className="divide-y divide-slate-100 dark:divide-white/10">
              {pickupOrders.map((order) => {
                const count = pickupOrderLines.filter((line) => line.pickup_order_id === order.id).length;
                return (
                  <li key={order.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(order.id)}
                      className={`flex w-full items-center justify-between gap-3 px-5 py-3 text-left transition ${
                        selectedId === order.id ? "bg-navy-50/70 dark:bg-white/5" : "hover:bg-slate-50 dark:hover:bg-white/5"
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-navy-900 dark:text-slate-100">
                          {df.format(new Date(order.requested_pickup_date))} · {warehouseById.get(order.warehouse_id)?.name ?? "Entrepôt"}
                        </p>
                        <p className="text-xs text-slate-400">
                          {count} ligne(s) · {order.pickup_address}
                        </p>
                      </div>
                      <span className={`shrink-0 rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase ${STATUS_TONES[order.status]}`}>
                        {STATUS_LABELS[order.status]}
                      </span>
                    </button>
                  </li>
                );
              })}
              {pickupOrders.length === 0 && (
                <li className="px-5 py-8 text-center text-sm text-slate-400">Aucune commande d&apos;enlèvement.</li>
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
                      Enlèvement du {df.format(new Date(selected.requested_pickup_date))}
                    </h2>
                    <p className="mt-1 text-xs text-slate-400">
                      {selected.pickup_address}
                      {selected.requested_window ? ` · ${selected.requested_window}` : ""}
                    </p>
                  </div>
                  <span className={`w-fit rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase ${STATUS_TONES[selected.status]}`}>
                    {STATUS_LABELS[selected.status]}
                  </span>
                </div>

                <div className="space-y-2 border-b border-slate-100 px-5 py-4 text-xs text-slate-500 dark:border-white/10 dark:text-slate-400">
                  {selected.pickup_contact_name && <p>Contact : {selected.pickup_contact_name}</p>}
                  {selected.pickup_contact_phone && <p>Téléphone : {selected.pickup_contact_phone}</p>}
                  {selected.notes && <p>Consignes : {selected.notes}</p>}
                  {selected.admin_notes && (
                    <p className="rounded-lg bg-amber-50 px-3 py-2 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                      Réponse FST : {selected.admin_notes}
                    </p>
                  )}
                </div>

                <ul className="divide-y divide-slate-100 dark:divide-white/10">
                  {lines.map((line) => {
                    const lot = lots.find((l) => l.id === line.lot_id);
                    const reference = lot ? referenceById.get(lot.product_reference_id) : undefined;
                    const product = reference ? productById.get(reference.product_id) : undefined;
                    return (
                      <li key={line.id} className="flex items-center justify-between gap-3 px-5 py-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-navy-900 dark:text-slate-100">
                            {recipientById.get(line.recipient_id)?.name ?? "Destinataire"}
                          </p>
                          <p className="truncate text-xs text-slate-400">
                            {product?.name ?? "Produit"} · <span className="font-mono">{lot?.lot_number ?? "—"}</span>
                          </p>
                        </div>
                        <span className="shrink-0 text-xs font-semibold tabular-nums text-slate-600 dark:text-slate-300">
                          {nf.format(line.quantity)} {line.unit ?? product?.unit ?? ""}
                        </span>
                      </li>
                    );
                  })}
                  {lines.length === 0 && <li className="px-5 py-6 text-center text-sm text-slate-400">Aucune ligne.</li>}
                </ul>
              </>
            )}
          </section>
        </div>

        <section className="card-pro p-5">
          <h2 className="font-display text-sm font-semibold text-navy-900 dark:text-white">Nouvelle commande</h2>
          <form onSubmit={submitOrder} className="mt-3 space-y-2">
            <select
              className={input}
              value={orderDraft.warehouse_id}
              onChange={(e) => {
                const warehouseId = e.target.value;
                setOrderDraft({ ...orderDraft, warehouse_id: warehouseId });
                setLineDraft((current) => ({ ...current, lot_id: "" }));
              }}
              required
            >
              <option value="">Entrepôt *</option>
              {warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>
              ))}
            </select>
            <input
              className={input}
              placeholder={defaultAddress ? `Adresse d'enlèvement (défaut : ${defaultAddress})` : "Adresse d'enlèvement *"}
              value={orderDraft.pickup_address}
              onChange={(e) => setOrderDraft({ ...orderDraft, pickup_address: e.target.value })}
            />
            <div className="grid gap-2 sm:grid-cols-2">
              <input
                className={input}
                type="date"
                value={orderDraft.requested_pickup_date}
                onChange={(e) => setOrderDraft({ ...orderDraft, requested_pickup_date: e.target.value })}
                required
              />
              <input
                className={input}
                placeholder="Créneau (ex. 9h-12h)"
                value={orderDraft.requested_window}
                onChange={(e) => setOrderDraft({ ...orderDraft, requested_window: e.target.value })}
              />
              <input
                className={input}
                placeholder="Contact sur place"
                value={orderDraft.contact_name}
                onChange={(e) => setOrderDraft({ ...orderDraft, contact_name: e.target.value })}
              />
              <input
                className={input}
                placeholder="Téléphone du contact"
                value={orderDraft.contact_phone}
                onChange={(e) => setOrderDraft({ ...orderDraft, contact_phone: e.target.value })}
              />
            </div>
            <input
              className={input}
              placeholder="Consignes pour l'enlèvement"
              value={orderDraft.notes}
              onChange={(e) => setOrderDraft({ ...orderDraft, notes: e.target.value })}
            />

            <div className="rounded-xl border border-slate-200 p-3 dark:border-white/10">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Lignes à enlever</p>
              <ul className="mt-2 space-y-1.5">
                {draftLines.map((line, index) => {
                  const lot = lots.find((l) => l.id === line.lot_id);
                  const reference = lot ? referenceById.get(lot.product_reference_id) : undefined;
                  const product = reference ? productById.get(reference.product_id) : undefined;
                  return (
                    <li key={`${line.lot_id}-${index}`} className="flex items-center justify-between gap-3 text-xs">
                      <span className="min-w-0 truncate text-slate-600 dark:text-slate-300">
                        {recipientById.get(line.recipient_id)?.name ?? "Destinataire"} · {product?.name ?? "Produit"} ·{" "}
                        <span className="font-mono">{lot?.lot_number ?? "—"}</span> · {nf.format(Number(line.quantity))} {line.unit || product?.unit || ""}
                      </span>
                      <button
                        type="button"
                        onClick={() => setDraftLines((current) => current.filter((_, i) => i !== index))}
                        className="text-xs font-semibold text-red-600 hover:underline"
                      >
                        Retirer
                      </button>
                    </li>
                  );
                })}
                {draftLines.length === 0 && <li className="text-xs text-slate-400">Aucune ligne ajoutée.</li>}
              </ul>

              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <select
                  className={input}
                  value={lineDraft.recipient_id}
                  onChange={(e) => setLineDraft({ ...lineDraft, recipient_id: e.target.value })}
                >
                  <option value="">Destinataire</option>
                  {recipients.map((recipient) => (
                    <option key={recipient.id} value={recipient.id}>{recipient.name}</option>
                  ))}
                </select>
                <select
                  className={input}
                  value={lineDraft.lot_id}
                  onChange={(e) => setLineDraft({ ...lineDraft, lot_id: e.target.value })}
                >
                  <option value="">Lot</option>
                  {warehouseLots.map((lot) => {
                    const reference = referenceById.get(lot.product_reference_id);
                    const product = reference ? productById.get(reference.product_id) : undefined;
                    return (
                      <option key={lot.id} value={lot.id}>
                        {product?.name ?? "Produit"} · {lot.lot_number}
                      </option>
                    );
                  })}
                </select>
                <input
                  className={input}
                  type="number"
                  min="0.001"
                  step="0.001"
                  placeholder="Quantité"
                  value={lineDraft.quantity}
                  onChange={(e) => setLineDraft({ ...lineDraft, quantity: e.target.value })}
                />
                <input
                  className={input}
                  placeholder="Unité"
                  value={lineDraft.unit}
                  onChange={(e) => setLineDraft({ ...lineDraft, unit: e.target.value })}
                />
              </div>
              <button
                type="button"
                onClick={addLine}
                disabled={!lineDraft.recipient_id || !lineDraft.lot_id || !lineDraft.quantity}
                className="mt-2 rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
              >
                Ajouter la ligne
              </button>
            </div>

            <button
              type="submit"
              disabled={busy || draftLines.length === 0}
              className="rounded-xl bg-navy-800 px-4 py-2 text-xs font-semibold text-white hover:bg-navy-700 disabled:opacity-60"
            >
              Envoyer la commande
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
