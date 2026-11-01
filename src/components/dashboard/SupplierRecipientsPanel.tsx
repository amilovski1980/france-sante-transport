"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createRecipient, deleteRecipient, updateRecipient } from "@/lib/api";
import { toUserMessage } from "@/lib/errors";
import type { Recipient, RecipientType } from "@/lib/types";
import type { SupplierWorkspace } from "@/lib/supplier-data";

const TYPES: { value: RecipientType; label: string }[] = [
  { value: "laboratory", label: "Laboratoire" },
  { value: "hospital", label: "Hôpital" },
  { value: "pharmacy", label: "Pharmacie" },
  { value: "clinic", label: "Clinique" },
  { value: "other", label: "Autre" },
];

const input =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-navy-400 dark:border-white/10 dark:bg-white/5 dark:text-slate-100";

type Draft = {
  name: string;
  type: RecipientType;
  contact_name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  postal_code: string;
  notes: string;
};

const EMPTY: Draft = {
  name: "",
  type: "other",
  contact_name: "",
  email: "",
  phone: "",
  address: "",
  city: "",
  postal_code: "",
  notes: "",
};

export default function SupplierRecipientsPanel({ workspace }: { workspace: SupplierWorkspace }) {
  const { supplier, recipients } = workspace;
  const router = useRouter();
  const [editing, setEditing] = useState<Recipient | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  function startEdit(recipient: Recipient) {
    setEditing(recipient);
    setDraft({
      name: recipient.name,
      type: recipient.type,
      contact_name: recipient.contact_name ?? "",
      email: recipient.email ?? "",
      phone: recipient.phone ?? "",
      address: recipient.address ?? "",
      city: recipient.city ?? "",
      postal_code: recipient.postal_code ?? "",
      notes: recipient.notes ?? "",
    });
  }

  function reset() {
    setEditing(null);
    setDraft(EMPTY);
  }

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      reset();
      router.refresh();
    } catch (err) {
      setError(toUserMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!supplier) return;
    await run(async () => {
      const payload = {
        name: draft.name.trim(),
        type: draft.type,
        contact_name: draft.contact_name.trim() || null,
        email: draft.email.trim() || null,
        phone: draft.phone.trim() || null,
        address: draft.address.trim() || null,
        city: draft.city.trim() || null,
        postal_code: draft.postal_code.trim() || null,
        notes: draft.notes.trim() || null,
      };
      if (editing) {
        await updateRecipient(editing.id, payload);
      } else {
        await createRecipient({ ...payload, supplier_id: supplier.id });
      }
    });
  }

  const filtered = recipients.filter((recipient) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      recipient.name.toLowerCase().includes(q) ||
      (recipient.city ?? "").toLowerCase().includes(q) ||
      (recipient.email ?? "").toLowerCase().includes(q)
    );
  });

  if (!supplier) {
    return <p className="surface p-6 text-sm text-slate-500">Aucun fournisseur rattaché à votre compte.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="card-pro flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-xl font-bold text-navy-900 dark:text-white">Destinataires</h1>
          <p className="mt-1 text-sm text-slate-400">{recipients.length} destinataire(s) visible(s)</p>
        </div>
        <input
          className={`${input} sm:w-64`}
          placeholder="Rechercher…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {error && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
          {error}
        </p>
      )}

      <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <section className="card-pro overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50/70 text-[11px] uppercase tracking-wide text-slate-400 dark:border-white/10 dark:bg-white/5">
                <tr>
                  <th className="px-4 py-3">Nom</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Contact</th>
                  <th className="px-4 py-3">Ville</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/10">
                {filtered.map((recipient) => {
                  const own = recipient.supplier_id === supplier.id;
                  return (
                    <tr key={recipient.id}>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-800 dark:text-slate-100">{recipient.name}</p>
                        <p className="text-[11px] text-slate-400">
                          {own ? "Mon carnet" : "Carnet global FST"}
                          {recipient.active ? "" : " · inactif"}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {TYPES.find((t) => t.value === recipient.type)?.label ?? recipient.type}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {recipient.contact_name && <p>{recipient.contact_name}</p>}
                        {recipient.email && <p>{recipient.email}</p>}
                        {recipient.phone && <p>{recipient.phone}</p>}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">{recipient.city ?? "—"}</td>
                      <td className="px-4 py-3 text-right">
                        {own ? (
                          <div className="flex justify-end gap-2">
                            <button type="button" onClick={() => startEdit(recipient)} className="text-xs font-semibold text-navy-700 hover:underline dark:text-slate-200">
                              Modifier
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => run(() => deleteRecipient(recipient.id))}
                              className="text-xs font-semibold text-red-600 hover:underline disabled:opacity-40"
                            >
                              Supprimer
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">Lecture seule</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-400">Aucun destinataire.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card-pro p-5">
          <h2 className="font-display text-sm font-semibold text-navy-900 dark:text-white">
            {editing ? "Modifier le destinataire" : "Nouveau destinataire"}
          </h2>
          <form onSubmit={submit} className="mt-3 space-y-2">
            <input className={input} placeholder="Nom *" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} required />
            <select className={input} value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value as RecipientType })}>
              {TYPES.map((type) => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
            <input className={input} placeholder="Contact" value={draft.contact_name} onChange={(e) => setDraft({ ...draft, contact_name: e.target.value })} />
            <input className={input} type="email" placeholder="E-mail" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} />
            <input className={input} placeholder="Téléphone" value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} />
            <input className={input} placeholder="Adresse" value={draft.address} onChange={(e) => setDraft({ ...draft, address: e.target.value })} />
            <div className="grid gap-2 sm:grid-cols-2">
              <input className={input} placeholder="Ville" value={draft.city} onChange={(e) => setDraft({ ...draft, city: e.target.value })} />
              <input className={input} placeholder="Code postal" value={draft.postal_code} onChange={(e) => setDraft({ ...draft, postal_code: e.target.value })} />
            </div>
            <input className={input} placeholder="Notes" value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
            <div className="flex gap-2">
              <button type="submit" disabled={busy} className="rounded-xl bg-navy-800 px-4 py-2 text-xs font-semibold text-white hover:bg-navy-700 disabled:opacity-60">
                {editing ? "Enregistrer" : "Ajouter"}
              </button>
              {editing && (
                <button type="button" onClick={reset} className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5">
                  Annuler
                </button>
              )}
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
