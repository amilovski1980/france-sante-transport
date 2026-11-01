"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createProduct, createProductReference, receiveStock } from "@/lib/api";
import { toUserMessage } from "@/lib/errors";
import type { SupplierWorkspace } from "@/lib/supplier-data";

const nf = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 });
const df = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" });

type Tab = "catalogue" | "stock" | "receive" | "movements";

const input =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-navy-400 dark:border-white/10 dark:bg-white/5 dark:text-slate-100";

export default function SupplierStockPanel({ workspace }: { workspace: SupplierWorkspace }) {
  const { supplier, warehouses, products, references, lots, stockLevels, movements } = workspace;
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("stock");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [productDraft, setProductDraft] = useState({
    name: "",
    category: "",
    unit: "unité",
    requires_cold_chain: false,
    temp_min: "",
    temp_max: "",
  });
  const [referenceDraft, setReferenceDraft] = useState({
    product_id: "",
    reference_code: "",
    packaging: "",
    unit: "",
    gtin: "",
  });
  const [receiveDraft, setReceiveDraft] = useState({
    warehouse_id: warehouses[0]?.id ?? "",
    product_reference_id: references[0]?.id ?? "",
    lot_number: "",
    quantity: "",
    expiry_date: "",
    note: "",
  });

  const referenceById = useMemo(() => new Map(references.map((r) => [r.id, r])), [references]);
  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const warehouseById = useMemo(() => new Map(warehouses.map((w) => [w.id, w])), [warehouses]);
  const levelByLot = useMemo(() => new Map(stockLevels.map((l) => [l.lot_id, l])), [stockLevels]);

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

  async function submitProduct(e: React.FormEvent) {
    e.preventDefault();
    if (!supplier) return;
    await run(async () => {
      await createProduct({
        supplier_id: supplier.id,
        name: productDraft.name.trim(),
        category: productDraft.category.trim() || null,
        unit: productDraft.unit.trim() || "unité",
        requires_cold_chain: productDraft.requires_cold_chain,
        temp_min: productDraft.temp_min ? Number(productDraft.temp_min) : null,
        temp_max: productDraft.temp_max ? Number(productDraft.temp_max) : null,
      });
      setProductDraft({ name: "", category: "", unit: "unité", requires_cold_chain: false, temp_min: "", temp_max: "" });
    });
  }

  async function submitReference(e: React.FormEvent) {
    e.preventDefault();
    await run(async () => {
      await createProductReference({
        product_id: referenceDraft.product_id,
        reference_code: referenceDraft.reference_code.trim(),
        packaging: referenceDraft.packaging.trim() || null,
        unit: referenceDraft.unit.trim() || null,
        gtin: referenceDraft.gtin.trim() || null,
      });
      setReferenceDraft({ product_id: "", reference_code: "", packaging: "", unit: "", gtin: "" });
    });
  }

  async function submitReceive(e: React.FormEvent) {
    e.preventDefault();
    if (!supplier) return;
    await run(async () => {
      await receiveStock({
        supplier_id: supplier.id,
        warehouse_id: receiveDraft.warehouse_id,
        product_reference_id: receiveDraft.product_reference_id,
        lot_number: receiveDraft.lot_number.trim(),
        quantity: Number(receiveDraft.quantity),
        expiry_date: receiveDraft.expiry_date || null,
        note: receiveDraft.note.trim() || null,
      });
      setReceiveDraft((d) => ({ ...d, lot_number: "", quantity: "", expiry_date: "", note: "" }));
    });
  }

  if (!supplier) {
    return <p className="surface p-6 text-sm text-slate-500">Aucun fournisseur rattaché à votre compte.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="card-pro flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-xl font-bold text-navy-900 dark:text-white">Stock & catalogue</h1>
          <p className="mt-1 text-sm text-slate-400">
            {products.length} produit(s) · {references.length} référence(s) · {lots.length} lot(s)
          </p>
        </div>
        <div className="flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1 dark:bg-white/5">
          {(
            [
              ["stock", "Stock"],
              ["catalogue", "Catalogue"],
              ["receive", "Réception"],
              ["movements", "Mouvements"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                tab === key
                  ? "bg-white text-navy-900 shadow-sm dark:bg-white/15 dark:text-white"
                  : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
          {error}
        </p>
      )}

      {tab === "stock" && (
        <section className="card-pro overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50/70 text-[11px] uppercase tracking-wide text-slate-400 dark:border-white/10 dark:bg-white/5">
                <tr>
                  <th className="px-4 py-3">Produit / référence</th>
                  <th className="px-4 py-3">Lot</th>
                  <th className="px-4 py-3">Entrepôt</th>
                  <th className="px-4 py-3">Péremption</th>
                  <th className="px-4 py-3 text-right">En stock</th>
                  <th className="px-4 py-3 text-right">Réservé</th>
                  <th className="px-4 py-3 text-right">Disponible</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/10">
                {lots.map((lot) => {
                  const reference = referenceById.get(lot.product_reference_id);
                  const product = reference ? productById.get(reference.product_id) : undefined;
                  const level = levelByLot.get(lot.id);
                  const available = level
                    ? Math.max(0, level.qty_on_hand - level.qty_reserved - level.qty_shipped)
                    : 0;
                  return (
                    <tr key={lot.id} className="text-slate-700 dark:text-slate-200">
                      <td className="px-4 py-3">
                        <p className="font-semibold">{product?.name ?? "Produit"}</p>
                        <p className="text-xs text-slate-400">{reference?.reference_code ?? "—"}</p>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">{lot.lot_number}</td>
                      <td className="px-4 py-3 text-xs">{warehouseById.get(lot.warehouse_id)?.name ?? "—"}</td>
                      <td className="px-4 py-3 text-xs">{lot.expiry_date ? df.format(new Date(lot.expiry_date)) : "—"}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{nf.format(level?.qty_on_hand ?? 0)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{nf.format(level?.qty_reserved ?? 0)}</td>
                      <td className={`px-4 py-3 text-right font-semibold tabular-nums ${available <= 5 ? "text-amber-600 dark:text-amber-400" : "text-emerald-700 dark:text-emerald-300"}`}>
                        {nf.format(available)}
                      </td>
                    </tr>
                  );
                })}
                {lots.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                      Aucun lot en stock. Commencez par une réception.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === "catalogue" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="card-pro overflow-hidden">
            <div className="border-b border-slate-100 px-5 py-3.5 dark:border-white/10">
              <h2 className="font-display text-sm font-semibold text-navy-900 dark:text-white">Produits</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-100 text-[11px] uppercase tracking-wide text-slate-400 dark:border-white/10">
                  <tr>
                    <th className="px-4 py-2.5">Nom</th>
                    <th className="px-4 py-2.5">Catégorie</th>
                    <th className="px-4 py-2.5">Unité</th>
                    <th className="px-4 py-2.5">Froid</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/10">
                  {products.map((product) => (
                    <tr key={product.id}>
                      <td className="px-4 py-2.5 font-semibold text-slate-800 dark:text-slate-100">{product.name}</td>
                      <td className="px-4 py-2.5 text-xs text-slate-500">{product.category ?? "—"}</td>
                      <td className="px-4 py-2.5 text-xs text-slate-500">{product.unit}</td>
                      <td className="px-4 py-2.5 text-xs">{product.requires_cold_chain ? "Oui" : "Non"}</td>
                    </tr>
                  ))}
                  {products.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-6 text-center text-slate-400">
                        Aucun produit.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <form onSubmit={submitProduct} className="space-y-2 border-t border-slate-100 p-4 dark:border-white/10">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Nouveau produit</p>
              <input className={input} placeholder="Nom du produit *" value={productDraft.name} onChange={(e) => setProductDraft({ ...productDraft, name: e.target.value })} required />
              <div className="grid gap-2 sm:grid-cols-2">
                <input className={input} placeholder="Catégorie" value={productDraft.category} onChange={(e) => setProductDraft({ ...productDraft, category: e.target.value })} />
                <input className={input} placeholder="Unité" value={productDraft.unit} onChange={(e) => setProductDraft({ ...productDraft, unit: e.target.value })} />
                <input className={input} type="number" step="0.1" placeholder="Temp. min" value={productDraft.temp_min} onChange={(e) => setProductDraft({ ...productDraft, temp_min: e.target.value })} />
                <input className={input} type="number" step="0.1" placeholder="Temp. max" value={productDraft.temp_max} onChange={(e) => setProductDraft({ ...productDraft, temp_max: e.target.value })} />
              </div>
              <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                <input type="checkbox" checked={productDraft.requires_cold_chain} onChange={(e) => setProductDraft({ ...productDraft, requires_cold_chain: e.target.checked })} />
                Chaîne du froid
              </label>
              <button type="submit" disabled={busy} className="rounded-xl bg-navy-800 px-4 py-2 text-xs font-semibold text-white hover:bg-navy-700 disabled:opacity-60">
                Ajouter le produit
              </button>
            </form>
          </section>

          <section className="card-pro overflow-hidden">
            <div className="border-b border-slate-100 px-5 py-3.5 dark:border-white/10">
              <h2 className="font-display text-sm font-semibold text-navy-900 dark:text-white">Références</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-100 text-[11px] uppercase tracking-wide text-slate-400 dark:border-white/10">
                  <tr>
                    <th className="px-4 py-2.5">Code</th>
                    <th className="px-4 py-2.5">Produit</th>
                    <th className="px-4 py-2.5">Conditionnement</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/10">
                  {references.map((reference) => (
                    <tr key={reference.id}>
                      <td className="px-4 py-2.5 font-mono text-xs">{reference.reference_code}</td>
                      <td className="px-4 py-2.5 text-xs text-slate-500">{productById.get(reference.product_id)?.name ?? "—"}</td>
                      <td className="px-4 py-2.5 text-xs text-slate-500">{reference.packaging ?? "—"}</td>
                    </tr>
                  ))}
                  {references.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-4 py-6 text-center text-slate-400">
                        Aucune référence.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <form onSubmit={submitReference} className="space-y-2 border-t border-slate-100 p-4 dark:border-white/10">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Nouvelle référence</p>
              <select className={input} value={referenceDraft.product_id} onChange={(e) => setReferenceDraft({ ...referenceDraft, product_id: e.target.value })} required>
                <option value="">Produit *</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>{product.name}</option>
                ))}
              </select>
              <input className={input} placeholder="Code référence *" value={referenceDraft.reference_code} onChange={(e) => setReferenceDraft({ ...referenceDraft, reference_code: e.target.value })} required />
              <div className="grid gap-2 sm:grid-cols-2">
                <input className={input} placeholder="Conditionnement" value={referenceDraft.packaging} onChange={(e) => setReferenceDraft({ ...referenceDraft, packaging: e.target.value })} />
                <input className={input} placeholder="Unité" value={referenceDraft.unit} onChange={(e) => setReferenceDraft({ ...referenceDraft, unit: e.target.value })} />
              </div>
              <button type="submit" disabled={busy || products.length === 0} className="rounded-xl bg-navy-800 px-4 py-2 text-xs font-semibold text-white hover:bg-navy-700 disabled:opacity-60">
                Ajouter la référence
              </button>
            </form>
          </section>
        </div>
      )}

      {tab === "receive" && (
        <section className="card-pro max-w-2xl p-5">
          <h2 className="font-display text-sm font-semibold text-navy-900 dark:text-white">Réception de stock</h2>
          <p className="mt-1 text-xs text-slate-400">
            Crée le lot si nécessaire, incrémente le stock et journalise un mouvement de réception.
          </p>
          <form onSubmit={submitReceive} className="mt-4 space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-xs font-semibold text-slate-500">
                Entrepôt *
                <select className={`${input} mt-1`} value={receiveDraft.warehouse_id} onChange={(e) => setReceiveDraft({ ...receiveDraft, warehouse_id: e.target.value })} required>
                  <option value="">Sélectionner</option>
                  {warehouses.map((warehouse) => (
                    <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-semibold text-slate-500">
                Référence produit *
                <select className={`${input} mt-1`} value={receiveDraft.product_reference_id} onChange={(e) => setReceiveDraft({ ...receiveDraft, product_reference_id: e.target.value })} required>
                  <option value="">Sélectionner</option>
                  {references.map((reference) => (
                    <option key={reference.id} value={reference.id}>
                      {reference.reference_code} · {productById.get(reference.product_id)?.name ?? ""}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-semibold text-slate-500">
                N° de lot *
                <input className={`${input} mt-1`} value={receiveDraft.lot_number} onChange={(e) => setReceiveDraft({ ...receiveDraft, lot_number: e.target.value })} required />
              </label>
              <label className="block text-xs font-semibold text-slate-500">
                Quantité *
                <input className={`${input} mt-1`} type="number" min="0.001" step="0.001" value={receiveDraft.quantity} onChange={(e) => setReceiveDraft({ ...receiveDraft, quantity: e.target.value })} required />
              </label>
              <label className="block text-xs font-semibold text-slate-500">
                Péremption
                <input className={`${input} mt-1`} type="date" value={receiveDraft.expiry_date} onChange={(e) => setReceiveDraft({ ...receiveDraft, expiry_date: e.target.value })} />
              </label>
              <label className="block text-xs font-semibold text-slate-500">
                Note
                <input className={`${input} mt-1`} value={receiveDraft.note} onChange={(e) => setReceiveDraft({ ...receiveDraft, note: e.target.value })} />
              </label>
            </div>
            <button type="submit" disabled={busy || !receiveDraft.warehouse_id || !receiveDraft.product_reference_id} className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">
              {busy ? "Enregistrement…" : "Réceptionner"}
            </button>
          </form>
        </section>
      )}

      {tab === "movements" && (
        <section className="card-pro overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50/70 text-[11px] uppercase tracking-wide text-slate-400 dark:border-white/10 dark:bg-white/5">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Lot</th>
                  <th className="px-4 py-3 text-right">Quantité</th>
                  <th className="px-4 py-3">Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/10">
                {movements.map((movement) => {
                  const lot = lots.find((l) => l.id === movement.lot_id);
                  return (
                    <tr key={movement.id}>
                      <td className="px-4 py-2.5 text-xs text-slate-500">{df.format(new Date(movement.created_at))}</td>
                      <td className="px-4 py-2.5 text-xs font-semibold uppercase text-slate-600 dark:text-slate-300">{movement.movement_type}</td>
                      <td className="px-4 py-2.5 font-mono text-xs">{lot?.lot_number ?? "—"}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{nf.format(movement.quantity)}</td>
                      <td className="px-4 py-2.5 text-xs text-slate-500">{movement.note ?? "—"}</td>
                    </tr>
                  );
                })}
                {movements.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                      Aucun mouvement.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
