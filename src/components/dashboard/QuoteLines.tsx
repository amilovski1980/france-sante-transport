"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toUserMessage } from "@/lib/errors";
import { useI18n } from "@/components/I18nProvider";
import type { QuoteLine } from "@/lib/types";

function money(amount: number, currency = "EUR", locale = "fr-FR") {
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(amount);
}

const inputClass =
  "w-full rounded-lg border border-navy-200 bg-white px-3 py-2 text-sm text-navy-900 focus:border-navy-500 focus:outline-none focus:ring-2 focus:ring-navy-100";

interface LineForm {
  description: string;
  quantity: string;
  unit_price: string;
}

const emptyForm: LineForm = { description: "", quantity: "1", unit_price: "0" };

/**
 * Détail des lignes d'un devis. Édition réservée aux brouillons (les RPC
 * métier rejettent sinon avec P0001) : quantités, prix unitaires, ajout et
 * suppression ; le montant du devis est recalculé côté base.
 */
export default function QuoteLines({
  quoteId,
  canEdit = false,
  currency = "EUR",
  initialLines,
  showHeading = true,
}: {
  quoteId: string;
  canEdit?: boolean;
  currency?: string;
  initialLines?: QuoteLine[];
  showHeading?: boolean;
}) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [lines, setLines] = useState<QuoteLine[] | null>(initialLines ?? null);
  const [error, setError] = useState<string | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState<LineForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<LineForm>(emptyForm);

  useEffect(() => {
    if (initialLines) return;
    let cancelled = false;
    async function load() {
      try {
        const { listQuoteLines } = await import("@/lib/api");
        const rows = await listQuoteLines(quoteId);
        if (!cancelled) setLines(rows);
      } catch (err) {
        if (!cancelled) setError(toUserMessage(err));
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [quoteId, initialLines]);

  function parseForm(form: LineForm): { description: string; quantity: number; unit_price: number } | null {
    const description = form.description.trim();
    const quantity = Number(form.quantity);
    const unitPrice = Number(form.unit_price);
    if (!description) return null;
    if (!Number.isFinite(quantity) || quantity <= 0) return null;
    if (!Number.isFinite(unitPrice) || unitPrice < 0) return null;
    return { description, quantity, unit_price: unitPrice };
  }

  async function run(key: string, action: () => Promise<unknown>, after: () => void) {
    setPendingKey(key);
    setError(null);
    try {
      await action();
      after();
      router.refresh();
    } catch (err) {
      setError(toUserMessage(err));
    } finally {
      setPendingKey(null);
    }
  }

  function handleAdd(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = parseForm(addForm);
    if (!parsed) {
      setError(t("ql.invalid"));
      return;
    }
    void run(
      "add",
      async () => {
        const { addQuoteLine, listQuoteLines } = await import("@/lib/api");
        await addQuoteLine(quoteId, parsed);
        setLines(await listQuoteLines(quoteId));
      },
      () => {
        setAddForm(emptyForm);
        setShowAdd(false);
      },
    );
  }

  function startEdit(line: QuoteLine) {
    setEditingId(line.id);
    setEditForm({
      description: line.description,
      quantity: String(line.quantity),
      unit_price: String(line.unit_price),
    });
  }

  function handleUpdate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingId) return;
    const parsed = parseForm(editForm);
    if (!parsed) {
      setError(t("ql.invalid"));
      return;
    }
    const id = editingId;
    void run(
      id,
      async () => {
        const { updateQuoteLine, listQuoteLines } = await import("@/lib/api");
        await updateQuoteLine(id, parsed);
        setLines(await listQuoteLines(quoteId));
      },
      () => setEditingId(null),
    );
  }

  function handleDelete(line: QuoteLine) {
    if (!window.confirm(t("ql.confirmDelete", { d: line.description }))) return;
    void run(
      `del-${line.id}`,
      async () => {
        const { deleteQuoteLine, listQuoteLines } = await import("@/lib/api");
        await deleteQuoteLine(line.id);
        setLines(await listQuoteLines(quoteId));
      },
      () => undefined,
    );
  }

  if (lines === null) {
    return <p className="text-xs text-navy-500">{t("ql.loading")}</p>;
  }

  const total = lines.reduce((sum, l) => sum + Number(l.quantity) * Number(l.unit_price), 0);

  return (
    <div className="space-y-3">
      {showHeading && (
        <p className="text-xs font-semibold uppercase tracking-widest text-navy-500">
          {t("ql.title")}
        </p>
      )}

      {lines.length === 0 ? (
        <p className="text-xs text-navy-500">
          {canEdit
            ? t("ql.emptyEdit")
            : t("ql.emptyRead")}
        </p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-navy-100 text-[11px] uppercase tracking-wider text-navy-500">
              <th className="py-1.5 pr-3 font-semibold">{t("ql.desc")}</th>
              <th className="py-1.5 pr-3 text-right font-semibold">{t("ql.qty")}</th>
              <th className="py-1.5 pr-3 text-right font-semibold">{t("ql.unitPrice")}</th>
              <th className="py-1.5 pr-3 text-right font-semibold">{t("ql.total")}</th>
              {canEdit && <th className="py-1.5 font-semibold">{t("ql.actions")}</th>}
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => {
              if (editingId === line.id) {
                return (
                  <tr key={line.id} className="border-b border-navy-50 align-top">
                    <td colSpan={canEdit ? 5 : 4} className="py-2 pr-3">
                      <form onSubmit={handleUpdate} className="grid gap-2 sm:grid-cols-[1fr_5rem_6rem_auto]">
                        <input
                          type="text"
                          required
                          maxLength={500}
                          value={editForm.description}
                          onChange={(e) =>
                            setEditForm((v) => ({ ...v, description: e.target.value }))
                          }
                          aria-label={t("ql.desc")}
                          className={inputClass}
                        />
                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          required
                          value={editForm.quantity}
                          onChange={(e) => setEditForm((v) => ({ ...v, quantity: e.target.value }))}
                          aria-label={t("ql.qtyAria")}
                          className={inputClass}
                        />
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          required
                          value={editForm.unit_price}
                          onChange={(e) =>
                            setEditForm((v) => ({ ...v, unit_price: e.target.value }))
                          }
                          aria-label={t("ql.priceAria")}
                          className={inputClass}
                        />
                        <div className="flex gap-2">
                          <button
                            type="submit"
                            disabled={pendingKey === line.id}
                            className="rounded-lg bg-navy-800 px-3 py-2 text-xs font-semibold text-white hover:bg-navy-700 disabled:opacity-60"
                          >
                            {pendingKey === line.id ? "…" : "OK"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="rounded-lg border border-navy-200 px-3 py-2 text-xs font-semibold text-navy-700 hover:bg-navy-50"
                          >
                            {t("common.cancel")}
                          </button>
                        </div>
                      </form>
                    </td>
                  </tr>
                );
              }
              return (
                <tr key={line.id} className="border-b border-navy-50">
                  <td className="py-2 pr-3 text-navy-800">{line.description}</td>
                  <td className="py-2 pr-3 text-right tabular-nums text-navy-700">
                    {Number(line.quantity)}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums text-navy-700">
                    {money(Number(line.unit_price), currency, locale)}
                  </td>
                  <td className="py-2 pr-3 text-right font-semibold tabular-nums text-navy-900">
                    {money(Number(line.quantity) * Number(line.unit_price), currency, locale)}
                  </td>
                  {canEdit && (
                    <td className="py-2">
                      <div className="flex gap-2 text-xs font-semibold">
                        <button
                          type="button"
                          onClick={() => startEdit(line)}
                          disabled={pendingKey !== null}
                          className="rounded border border-navy-200 px-2 py-1 text-navy-700 hover:bg-navy-50 disabled:opacity-60"
                        >
                          Modifier
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(line)}
                          disabled={pendingKey !== null}
                          className="rounded border border-flagred-300 px-2 py-1 text-flagred-700 hover:bg-flagred-50 disabled:opacity-60"
                        >
                          Supprimer
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-navy-200">
              <td
                colSpan={canEdit ? 3 : 3}
                className="py-2 pr-3 text-right text-xs font-semibold uppercase tracking-wider text-navy-500"
              >
                {t("ql.linesTotal")}
              </td>
              <td className="py-2 pr-3 text-right text-sm font-bold tabular-nums text-navy-900">
                {money(total, currency, locale)}
              </td>
              {canEdit && <td />}
            </tr>
          </tfoot>
        </table>
      )}

      {error && <p className="text-xs text-flagred-700">{error}</p>}

      {canEdit && (
        <div>
          {!showAdd ? (
            <button
              type="button"
              onClick={() => setShowAdd(true)}
              className="rounded-lg border border-dashed border-navy-300 px-3 py-1.5 text-xs font-semibold text-navy-700 transition hover:border-navy-500 hover:text-navy-900"
            >
              {t("ql.addLine")}
            </button>
          ) : (
            <form onSubmit={handleAdd} className="grid gap-2 rounded-lg bg-navy-50 p-3 sm:grid-cols-[1fr_5rem_6rem_auto]">
              <input
                type="text"
                required
                maxLength={500}
                placeholder={t("ql.descPh")}
                value={addForm.description}
                onChange={(e) => setAddForm((v) => ({ ...v, description: e.target.value }))}
                aria-label={t("ql.desc")}
                className={inputClass}
              />
              <input
                type="number"
                min="0.01"
                step="0.01"
                placeholder="1"
                value={addForm.quantity}
                onChange={(e) => setAddForm((v) => ({ ...v, quantity: e.target.value }))}
                aria-label={t("ql.qtyAria")}
                className={inputClass}
              />
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="0,00"
                value={addForm.unit_price}
                onChange={(e) => setAddForm((v) => ({ ...v, unit_price: e.target.value }))}
                aria-label={t("ql.priceAria")}
                className={inputClass}
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={pendingKey === "add"}
                  className="rounded-lg bg-flagred-600 px-3 py-2 text-xs font-semibold text-white hover:bg-flagred-700 disabled:opacity-60"
                >
                  {pendingKey === "add" ? "…" : t("ql.add")}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAdd(false)}
                  className="rounded-lg border border-navy-200 px-3 py-2 text-xs font-semibold text-navy-700 hover:bg-navy-50"
                >
                  Annuler
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {canEdit && lines.length > 0 && (
        <p className="text-[11px] leading-relaxed text-navy-500">
          {t("ql.amountNote")}
        </p>
      )}
    </div>
  );
}
