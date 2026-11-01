"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  createPurchaseInvoice,
  createPurchaseInvoiceLine,
  deletePurchaseInvoiceLine,
} from "@/lib/api";
import { toUserMessage } from "@/lib/errors";
import type { SupplierWorkspace } from "@/lib/supplier-data";

const nf = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 });
const df = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" });

const input =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-navy-400 dark:border-white/10 dark:bg-white/5 dark:text-slate-100";

export default function SupplierInvoicesPanel({ workspace }: { workspace: SupplierWorkspace }) {
  const { supplier, invoices, invoiceLines, references, products } = workspace;
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(invoices[0]?.id ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadDraft, setUploadDraft] = useState({
    invoice_number: "",
    invoice_date: new Date().toISOString().slice(0, 10),
    total_amount: "",
  });
  const [lineDraft, setLineDraft] = useState({
    product_reference_id: "",
    description: "",
    quantity: "",
    unit_price: "",
    lot_number: "",
    expiry_date: "",
  });

  const referenceById = useMemo(() => new Map(references.map((r) => [r.id, r])), [references]);
  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const selected = invoices.find((invoice) => invoice.id === selectedId) ?? null;
  const lines = selected ? invoiceLines.filter((line) => line.purchase_invoice_id === selected.id) : [];

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

  async function submitUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!supplier) return;
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError("Sélectionnez un fichier PDF, Excel ou image.");
      return;
    }
    await run(async () => {
      const supabase = createClient();
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${supplier.id}/${Date.now()}-${safeName}`;
      const { error: uploadError } = await supabase.storage
        .from("purchase-invoices")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (uploadError) throw uploadError;

      const invoice = await createPurchaseInvoice({
        supplier_id: supplier.id,
        invoice_number: uploadDraft.invoice_number.trim(),
        invoice_date: uploadDraft.invoice_date || null,
        total_amount: uploadDraft.total_amount ? Number(uploadDraft.total_amount) : null,
        file_path: path,
        file_name: file.name,
        mime_type: file.type,
      });
      setSelectedId(invoice.id);
      setUploadDraft((d) => ({ ...d, invoice_number: "", total_amount: "" }));
      if (fileRef.current) fileRef.current.value = "";
    });
  }

  async function submitLine(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    await run(async () => {
      await createPurchaseInvoiceLine({
        purchase_invoice_id: selected.id,
        product_reference_id: lineDraft.product_reference_id || null,
        description: lineDraft.description.trim(),
        quantity: Number(lineDraft.quantity),
        unit_price: lineDraft.unit_price ? Number(lineDraft.unit_price) : null,
        lot_number: lineDraft.lot_number.trim() || null,
        expiry_date: lineDraft.expiry_date || null,
      });
      setLineDraft((d) => ({ ...d, description: "", quantity: "", unit_price: "", lot_number: "", expiry_date: "" }));
    });
  }

  async function openFile(path: string) {
    const supabase = createClient();
    const { data, error: signedError } = await supabase.storage
      .from("purchase-invoices")
      .createSignedUrl(path, 60 * 10);
    if (signedError) {
      setError(toUserMessage(signedError));
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  if (!supplier) {
    return <p className="surface p-6 text-sm text-slate-500">Aucun fournisseur rattaché à votre compte.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="card-pro p-5">
        <h1 className="font-display text-xl font-bold text-navy-900 dark:text-white">Factures d&apos;achat</h1>
        <p className="mt-1 text-sm text-slate-400">
          Importez la facture puis saisissez ses lignes : elles alimentent la réception de stock.
        </p>
      </div>

      {error && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
          {error}
        </p>
      )}

      <div className="grid gap-4 xl:grid-cols-[1fr_1.5fr]">
        <div className="space-y-4">
          <section className="card-pro overflow-hidden">
            <div className="border-b border-slate-100 px-5 py-3.5 dark:border-white/10">
              <h2 className="font-display text-sm font-semibold text-navy-900 dark:text-white">Factures importées</h2>
            </div>
            <ul className="divide-y divide-slate-100 dark:divide-white/10">
              {invoices.map((invoice) => (
                <li key={invoice.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(invoice.id)}
                    className={`flex w-full items-center justify-between gap-3 px-5 py-3 text-left transition ${
                      selectedId === invoice.id ? "bg-navy-50/70 dark:bg-white/5" : "hover:bg-slate-50 dark:hover:bg-white/5"
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-navy-900 dark:text-slate-100">{invoice.invoice_number}</p>
                      <p className="text-xs text-slate-400">
                        {invoice.invoice_date ? df.format(new Date(invoice.invoice_date)) : df.format(new Date(invoice.created_at))}
                        {invoice.file_name ? ` · ${invoice.file_name}` : ""}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs font-semibold text-slate-500">
                      {invoice.total_amount != null ? `${nf.format(invoice.total_amount)} €` : "—"}
                    </span>
                  </button>
                </li>
              ))}
              {invoices.length === 0 && (
                <li className="px-5 py-8 text-center text-sm text-slate-400">Aucune facture.</li>
              )}
            </ul>
          </section>

          <section className="card-pro p-5">
            <h2 className="font-display text-sm font-semibold text-navy-900 dark:text-white">Importer une facture</h2>
            <form onSubmit={submitUpload} className="mt-3 space-y-2">
              <input className={input} placeholder="Numéro de facture *" value={uploadDraft.invoice_number} onChange={(e) => setUploadDraft({ ...uploadDraft, invoice_number: e.target.value })} required />
              <div className="grid gap-2 sm:grid-cols-2">
                <input className={input} type="date" value={uploadDraft.invoice_date} onChange={(e) => setUploadDraft({ ...uploadDraft, invoice_date: e.target.value })} />
                <input className={input} type="number" min="0" step="0.01" placeholder="Montant total" value={uploadDraft.total_amount} onChange={(e) => setUploadDraft({ ...uploadDraft, total_amount: e.target.value })} />
              </div>
              <input ref={fileRef} type="file" accept=".pdf,.xlsx,.xls,.csv,image/*" className="block w-full rounded-xl border border-dashed border-slate-300 px-3.5 py-2.5 text-xs text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-navy-800 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white dark:border-white/15 dark:text-slate-400" />
              <button type="submit" disabled={busy} className="rounded-xl bg-navy-800 px-4 py-2 text-xs font-semibold text-white hover:bg-navy-700 disabled:opacity-60">
                Importer
              </button>
            </form>
          </section>
        </div>

        <section className="card-pro overflow-hidden">
          {!selected ? (
            <p className="p-8 text-center text-sm text-slate-400">Sélectionnez une facture.</p>
          ) : (
            <>
              <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 dark:border-white/10 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="font-display text-base font-semibold text-navy-900 dark:text-white">{selected.invoice_number}</h2>
                  <p className="mt-1 text-xs text-slate-400">
                    {selected.invoice_date ? df.format(new Date(selected.invoice_date)) : "Date non renseignée"}
                    {selected.file_name ? ` · ${selected.file_name}` : ""}
                  </p>
                </div>
                {selected.file_path && (
                  <button
                    type="button"
                    onClick={() => void openFile(selected.file_path as string)}
                    className="w-fit rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/5"
                  >
                    Ouvrir le fichier
                  </button>
                )}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-left text-sm">
                  <thead className="border-b border-slate-100 bg-slate-50/70 text-[11px] uppercase tracking-wide text-slate-400 dark:border-white/10 dark:bg-white/5">
                    <tr>
                      <th className="px-4 py-2.5">Description</th>
                      <th className="px-4 py-2.5">Lot</th>
                      <th className="px-4 py-2.5 text-right">Quantité</th>
                      <th className="px-4 py-2.5 text-right">Prix unitaire</th>
                      <th className="px-4 py-2.5" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/10">
                    {lines.map((line) => {
                      const reference = line.product_reference_id ? referenceById.get(line.product_reference_id) : undefined;
                      const product = reference ? productById.get(reference.product_id) : undefined;
                      return (
                        <tr key={line.id}>
                          <td className="px-4 py-2.5">
                            <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                              {line.description}
                            </p>
                            <p className="text-[11px] text-slate-400">
                              {product?.name ?? ""} {reference ? `· ${reference.reference_code}` : ""}
                            </p>
                          </td>
                          <td className="px-4 py-2.5 text-xs text-slate-500">{line.lot_number ?? "—"}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums">{nf.format(line.quantity)}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums">
                            {line.unit_price != null ? `${nf.format(line.unit_price)} €` : "—"}
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => run(() => deletePurchaseInvoiceLine(line.id))}
                              className="text-xs font-semibold text-red-600 hover:underline disabled:opacity-40"
                            >
                              Supprimer
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {lines.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-4 py-6 text-center text-slate-400">Aucune ligne.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <form onSubmit={submitLine} className="space-y-2 border-t border-slate-100 p-4 dark:border-white/10">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Ajouter une ligne</p>
                <select className={input} value={lineDraft.product_reference_id} onChange={(e) => setLineDraft({ ...lineDraft, product_reference_id: e.target.value })}>
                  <option value="">Référence produit (facultatif)</option>
                  {references.map((reference) => (
                    <option key={reference.id} value={reference.id}>
                      {reference.reference_code} · {productById.get(reference.product_id)?.name ?? ""}
                    </option>
                  ))}
                </select>
                <input className={input} placeholder="Description *" value={lineDraft.description} onChange={(e) => setLineDraft({ ...lineDraft, description: e.target.value })} required />
                <div className="grid gap-2 sm:grid-cols-2">
                  <input className={input} type="number" min="0.001" step="0.001" placeholder="Quantité *" value={lineDraft.quantity} onChange={(e) => setLineDraft({ ...lineDraft, quantity: e.target.value })} required />
                  <input className={input} type="number" min="0" step="0.0001" placeholder="Prix unitaire" value={lineDraft.unit_price} onChange={(e) => setLineDraft({ ...lineDraft, unit_price: e.target.value })} />
                  <input className={input} placeholder="N° de lot" value={lineDraft.lot_number} onChange={(e) => setLineDraft({ ...lineDraft, lot_number: e.target.value })} />
                  <input className={input} type="date" value={lineDraft.expiry_date} onChange={(e) => setLineDraft({ ...lineDraft, expiry_date: e.target.value })} />
                </div>
                <button type="submit" disabled={busy} className="rounded-xl bg-navy-800 px-4 py-2 text-xs font-semibold text-white hover:bg-navy-700 disabled:opacity-60">
                  Ajouter la ligne
                </button>
              </form>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
