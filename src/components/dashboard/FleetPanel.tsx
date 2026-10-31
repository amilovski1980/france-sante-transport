"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toUserMessage } from "@/lib/errors";
import type { AppRole, Vehicle } from "@/lib/types";

type VehicleType = Vehicle["vehicle_type"];

const TYPES: { value: VehicleType; label: string }[] = [
  { value: "van", label: "Fourgon frigorifique (2–8 °C)" },
  { value: "stretcher_van", label: "Isotherme carboglace (-78,5 °C)" },
  { value: "minibus", label: "Van d'enlèvement" },
  { value: "ambulance", label: "Véhicule UN 3373 (biologie)" },
  { value: "sedan", label: "Véhicule messagerie santé" },
  { value: "moto", label: "Moto messagerie" },
];

type Draft = {
  registration_plate: string;
  vehicle_type: VehicleType;
  label: string;
  capacity: string;
  has_wheelchair_lift: boolean;
  active: boolean;
};

const EMPTY: Draft = {
  registration_plate: "",
  vehicle_type: "van",
  label: "",
  capacity: "2",
  has_wheelchair_lift: false,
  active: true,
};

const inputCls =
  "mt-1 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-navy-400 dark:border-white/10 dark:bg-[#12161f] dark:text-slate-200";

function typeLabel(t: VehicleType): string {
  return TYPES.find((x) => x.value === t)?.label ?? t;
}

/**
 * Gestion de la flotte : liste, création, édition, activation et
 * suppression des véhicules (écritures réservées à l'admin par RLS ;
 * le dispatcher consulte).
 */
export default function FleetPanel({ initial, role }: { initial: Vehicle[]; role: AppRole }) {
  const isAdmin = role === "admin";
  const [vehicles, setVehicles] = useState(initial);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const supabase = useMemo(() => createClient(), []);
  const activeCount = vehicles.filter((v) => v.active).length;

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function startEdit(v: Vehicle) {
    setEditingId(v.id);
    setDraft({
      registration_plate: v.registration_plate,
      vehicle_type: v.vehicle_type,
      label: v.label ?? "",
      capacity: String(v.capacity),
      has_wheelchair_lift: v.has_wheelchair_lift,
      active: v.active,
    });
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setInfo(null);

    const plate = draft.registration_plate.trim().toUpperCase();
    if (!/^[A-Z0-9-]{6,12}$/.test(plate)) {
      setError("Immatriculation invalide : 6–12 caractères A-Z, 0-9 ou - (ex. AB-123-CD).");
      return;
    }
    const capacity = Number(draft.capacity);
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > 20) {
      setError("Capacité invalide (1 à 20).");
      return;
    }

    const payload = {
      registration_plate: plate,
      vehicle_type: draft.vehicle_type,
      label: draft.label.trim() || null,
      capacity,
      has_wheelchair_lift: draft.has_wheelchair_lift,
      active: draft.active,
    };

    setBusy(true);
    try {
      if (editingId) {
        const { error: err } = await supabase.from("vehicles").update(payload).eq("id", editingId);
        if (err) throw err;
        setVehicles((prev) => prev.map((v) => (v.id === editingId ? { ...v, ...payload } : v)));
        setInfo(`Véhicule ${plate} mis à jour ✓`);
      } else {
        const { data, error: err } = await supabase.from("vehicles").insert(payload).select().single();
        if (err) throw err;
        setVehicles((prev) => [...prev, data as Vehicle]);
        setInfo(`Véhicule ${plate} ajouté à la flotte ✓`);
      }
      setDraft(EMPTY);
      setEditingId(null);
    } catch (err) {
      setError(toUserMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(v: Vehicle) {
    setBusy(true);
    setError(null);
    try {
      const { error: err } = await supabase.from("vehicles").update({ active: !v.active }).eq("id", v.id);
      if (err) throw err;
      setVehicles((prev) => prev.map((x) => (x.id === v.id ? { ...x, active: !v.active } : x)));
    } catch (err) {
      setError(toUserMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function remove(v: Vehicle) {
    if (!window.confirm(`Supprimer le véhicule ${v.registration_plate} ?`)) return;
    setBusy(true);
    setError(null);
    try {
      const { error: err } = await supabase.from("vehicles").delete().eq("id", v.id);
      if (err) throw err;
      setVehicles((prev) => prev.filter((x) => x.id !== v.id));
      setInfo(`Véhicule ${v.registration_plate} supprimé ✓`);
    } catch (err) {
      setError(toUserMessage(err));
    } finally {
      setBusy(false);
    }
  }

  function cancel() {
    setEditingId(null);
    setDraft(EMPTY);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-navy-900 dark:text-slate-100">Flotte</h1>
          <p className="mt-1 text-sm text-slate-400">{vehicles.length} véhicule(s) · {activeCount} actif(s)</p>
        </div>
        <div className="flex gap-2">
          <span className="rounded-xl bg-navy-50 px-4 py-2 text-sm font-semibold text-navy-800 dark:bg-white/10 dark:text-slate-200">
            🏍️ {vehicles.length}
          </span>
          <span className="rounded-xl bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
            Actifs : {activeCount}
          </span>
        </div>
      </div>

      {error && <div className="rounded-xl bg-red-50 px-5 py-3 text-sm font-semibold text-red-700 dark:bg-red-500/10 dark:text-red-300">⚠️ {error}</div>}
      {info && !error && <div className="rounded-xl bg-emerald-50 px-5 py-3 text-sm font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">✅ {info}</div>}

      {isAdmin && (
        <form onSubmit={submit} className="card-pro">
          <div className="border-b border-slate-100 px-5 py-4 dark:border-white/10">
            <h2 className="text-sm font-bold uppercase tracking-wide text-navy-700 dark:text-slate-200">
              {editingId ? "✏️ Modifier le véhicule" : "➕ Ajouter un véhicule"}
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-4 px-5 py-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Immatriculation *</label>
              <input value={draft.registration_plate} onChange={(e) => set("registration_plate", e.target.value)} placeholder="AB-123-CD" className={inputCls} />
            </div>
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Type *</label>
              <select value={draft.vehicle_type} onChange={(e) => set("vehicle_type", e.target.value as VehicleType)} className={inputCls}>
                {TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Libellé</label>
              <input value={draft.label} onChange={(e) => set("label", e.target.value)} placeholder="VSL n°1 — Bruno" className={inputCls} />
            </div>
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Capacité (colis / emplacements) *</label>
              <input type="number" min={1} max={20} value={draft.capacity} onChange={(e) => set("capacity", e.target.value)} className={inputCls} />
            </div>
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                <input type="checkbox" checked={draft.has_wheelchair_lift} onChange={(e) => set("has_wheelchair_lift", e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
                ❄ Frigorifique
              </label>
            </div>
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                <input type="checkbox" checked={draft.active} onChange={(e) => set("active", e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
                Véhicule actif
              </label>
            </div>
          </div>
          <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-5 py-4 dark:border-white/10">
            {editingId && (
              <button type="button" onClick={cancel} className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300">
                Annuler
              </button>
            )}
            <button type="submit" disabled={busy} className="rounded-xl bg-navy-700 px-6 py-2.5 text-sm font-semibold text-white hover:bg-navy-800 disabled:opacity-40">
              {busy ? "⏳ Enregistrement…" : editingId ? "Enregistrer les modifications" : "Ajouter à la flotte"}
            </button>
          </div>
        </form>
      )}

      {/* Liste */}
      <div className="card-pro overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-4 dark:border-white/10">
          <h2 className="text-sm font-bold uppercase tracking-wide text-navy-700 dark:text-slate-200">Véhicules</h2>
        </div>
        {vehicles.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-slate-400">Aucun véhicule enregistré.</p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-white/5">
            {vehicles.map((v) => (
              <li key={v.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                    🏍️ <span className="font-mono">{v.registration_plate}</span> · {typeLabel(v.vehicle_type)}
                    {v.label && <span className="ml-2 text-xs text-slate-400">{v.label}</span>}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {v.capacity} place(s) {v.has_wheelchair_lift && " · ❄ frigorifique"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${v.active ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" : "bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-400"}`}>
                    {v.active ? "ACTIVE" : "INACTIVE"}
                  </span>
                  {isAdmin && (
                    <>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void toggleActive(v)}
                        className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-navy-700 hover:bg-slate-50 disabled:opacity-40 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10"
                      >
                        {v.active ? "⏸ Désactiver" : "▶ Activer"}
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => startEdit(v)}
                        className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-navy-700 hover:bg-slate-50 disabled:opacity-40 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10"
                      >
                        ✏️
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void remove(v)}
                        className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-40 dark:border-white/10 dark:text-red-400"
                      >
                        🗑
                      </button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
