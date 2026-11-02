"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createWarehouse, updateWarehouse } from "@/lib/api";
import { toUserMessage } from "@/lib/errors";
import type { Warehouse } from "@/lib/types";

const input =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-navy-400 dark:border-white/10 dark:bg-white/5 dark:text-slate-100";

export default function AdminWarehousesPanel({
  warehouses,
  isAdmin,
}: {
  warehouses: Warehouse[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState({ name: "", code: "", address: "", capacity_m3: "" });

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

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    await run(async () => {
      await createWarehouse({
        name: draft.name.trim(),
        code: draft.code.trim(),
        address: draft.address.trim() || null,
        capacity_m3: draft.capacity_m3 ? Number(draft.capacity_m3) : null,
      });
      setDraft({ name: "", code: "", address: "", capacity_m3: "" });
    });
  }

  return (
    <div className="space-y-4">
      <div className="card-pro p-5">
        <h1 className="font-display text-xl font-bold text-navy-900 dark:text-white">Entrepôts</h1>
        <p className="mt-1 text-sm text-slate-400">
          Les entrepôts accueillent les lots et les ordres de préparation.
        </p>
      </div>

      {error && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
          {error}
        </p>
      )}

      <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <section className="card-pro overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50/70 text-[11px] uppercase tracking-wide text-slate-400 dark:border-white/10 dark:bg-white/5">
                <tr>
                  <th className="px-4 py-3">Nom</th>
                  <th className="px-4 py-3">Code</th>
                  <th className="px-4 py-3">Adresse</th>
                  <th className="px-4 py-3 text-right">Capacité</th>
                  <th className="px-4 py-3">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/10">
                {warehouses.map((warehouse) => (
                  <tr key={warehouse.id}>
                    <td className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-100">{warehouse.name}</td>
                    <td className="px-4 py-3 font-mono text-xs">{warehouse.code}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{warehouse.address ?? "—"}</td>
                    <td className="px-4 py-3 text-right text-xs tabular-nums">
                      {warehouse.capacity_m3 != null ? `${warehouse.capacity_m3} m³` : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {isAdmin ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => run(() => updateWarehouse(warehouse.id, { active: !warehouse.active }))}
                          className={`rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase disabled:opacity-50 ${
                            warehouse.active
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                              : "bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-400"
                          }`}
                        >
                          {warehouse.active ? "Actif" : "Inactif"}
                        </button>
                      ) : (
                        <span className="text-xs text-slate-500">{warehouse.active ? "Actif" : "Inactif"}</span>
                      )}
                    </td>
                  </tr>
                ))}
                {warehouses.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-400">Aucun entrepôt.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {isAdmin && (
          <section className="card-pro p-5">
            <h2 className="font-display text-sm font-semibold text-navy-900 dark:text-white">Nouvel entrepôt</h2>
            <form onSubmit={submit} className="mt-3 space-y-2">
              <input className={input} placeholder="Nom *" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} required />
              <input className={input} placeholder="Code *" value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value })} required />
              <input className={input} placeholder="Adresse" value={draft.address} onChange={(e) => setDraft({ ...draft, address: e.target.value })} />
              <input className={input} type="number" min="0" step="0.01" placeholder="Capacité (m³)" value={draft.capacity_m3} onChange={(e) => setDraft({ ...draft, capacity_m3: e.target.value })} />
              <button type="submit" disabled={busy} className="rounded-xl bg-navy-800 px-4 py-2 text-xs font-semibold text-white hover:bg-navy-700 disabled:opacity-60">
                Créer l&apos;entrepôt
              </button>
            </form>
          </section>
        )}
      </div>
    </div>
  );
}
