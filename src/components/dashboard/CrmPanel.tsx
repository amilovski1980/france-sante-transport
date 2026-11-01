"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { AppRole, CrmNote, EmailLog, Profile, Quote, TransportRequest } from "@/lib/types";

type Client = Pick<Profile, "id" | "full_name" | "email" | "role" | "phone" | "avatar_url" | "address" | "created_at">;

const AVATAR_TONES = ["bg-navy-600", "bg-flagred-600", "bg-emerald-600", "bg-amber-600", "bg-blue-600", "bg-violet-600"];

const KIND_LABELS: Record<CrmNote["kind"], string> = {
  note: "Note",
  call: "Appel",
  email: "E-mail",
};

const KIND_STYLES: Record<CrmNote["kind"], string> = {
  note: "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300",
  call: "bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  email: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
};

const STATUS_FR: Record<string, string> = {
  draft: "Brouillon", submitted: "Soumise", under_review: "En examen", quoted: "Devis émis",
  accepted: "Acceptée", rejected: "Refusée", cancelled: "Annulée", completed: "Terminée",
};

function money(n: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);
}

function initials(name: string) {
  return name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase() || "?";
}

function toneOf(id: string) {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return AVATAR_TONES[h % AVATAR_TONES.length];
}

export default function CrmPanel({
  clients,
  requests,
  quotes,
  emailLog,
}: {
  clients: Client[];
  requests: Pick<TransportRequest, "id" | "client_id" | "status" | "pickup_address" | "dropoff_address" | "created_at">[];
  quotes: Pick<Quote, "id" | "status" | "amount" | "transport_request_id">[];
  emailLog: Pick<EmailLog, "id" | "recipient_id" | "subject" | "status" | "created_at">[];
}) {
  const supabase = useMemo(() => createClient(), []);
  const [sel, setSel] = useState<Client | null>(null);
  const [search, setSearch] = useState("");
  const [notes, setNotes] = useState<Record<string, CrmNote[]>>({});
  const [noteDraft, setNoteDraft] = useState("");
  const [noteKind, setNoteKind] = useState<CrmNote["kind"]>("note");
  const [savingNote, setSavingNote] = useState(false);

  // Index des statistiques
  const statsById = useMemo(() => {
    const byId = new Map<string, { requests: number; quotesAccepted: number; revenue: number; lastActivity: string | null }>();
    for (const c of clients) byId.set(c.id, { requests: 0, quotesAccepted: 0, revenue: 0, lastActivity: null });
    for (const r of requests) {
      const s = byId.get(r.client_id);
      if (!s) continue;
      s.requests += 1;
      const ts = r.created_at;
      if (!s.lastActivity || ts > s.lastActivity) s.lastActivity = ts;
    }
    for (const q of quotes) {
      if (q.status !== "accepted") continue;
      const req = requests.find((r) => r.id === q.transport_request_id);
      if (!req) continue;
      const s = byId.get(req.client_id);
      if (!s) continue;
      s.quotesAccepted += 1;
      s.revenue += Number(q.amount) || 0;
    }
    return byId;
  }, [clients, requests, quotes]);

  const emailById = useMemo(() => {
    const m = new Map<string, Pick<EmailLog, "id" | "subject" | "status" | "created_at">[]>();
    for (const e of emailLog) {
      const key = e.recipient_id ?? "";
      const arr = m.get(key) ?? [];
      arr.push(e);
      m.set(key, arr);
    }
    return m;
  }, [emailLog]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return clients.filter(
      (c) => !q || (c.full_name || "").toLowerCase().includes(q) || c.email.toLowerCase().includes(q),
    );
  }, [clients, search]);

  const loadNotes = async (clientId: string) => {
    const { data } = await supabase
      .from("crm_notes")
      .select("*")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false })
      .limit(50);
    setNotes((prev) => ({ ...prev, [clientId]: (data ?? []) as CrmNote[] }));
  };

  useEffect(() => {
    if (sel && !notes[sel.id]) void loadNotes(sel.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel]);

  async function addNote() {
    if (!sel || !noteDraft.trim() || savingNote) return;
    setSavingNote(true);
    const { data: me } = await supabase.auth.getUser();
    const { data: created } = await supabase
      .from("crm_notes")
      .insert({ client_id: sel.id, author_id: me.user?.id, kind: noteKind, body: noteDraft.trim() })
      .select()
      .single();
    setSavingNote(false);
    if (created) {
      setNotes((prev) => ({ ...prev, [sel.id]: [created as CrmNote, ...(prev[sel.id] ?? [])] }));
      setNoteDraft("");
    }
  }

  const timeline = (id: string) => [
    ...(emailById.get(id) ?? []).map((e) => ({
      kind: "email" as const,
      body: e.subject,
      date: e.created_at,
      status: e.status,
    })),
    ...(notes[id] ?? []).map((n) => ({ kind: n.kind, body: n.body, date: n.created_at, status: null })),
    ...(requests.filter((r) => r.client_id === id) as TransportRequest[]).map((r) => ({
      kind: "note" as const,
      body: `${STATUS_FR[r.status] || r.status} — ${r.pickup_address} → ${r.dropoff_address}`,
      date: r.created_at,
      status: null,
    })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-navy-900 dark:text-slate-100">CRM Clients &amp; Partenaires</h1>
        <p className="mt-1 text-sm text-slate-400">
          {clients.length} fiches · {statsByTotal(clients, statsById)} demande{statsByTotal(clients, statsById) > 1 ? "s" : ""} au total
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[20rem_1fr]">
        {/* Liste clients */}
        <div className="card-pro overflow-hidden self-start">
          <div className="space-y-3 border-b border-slate-100 px-5 py-4 dark:border-white/10">
            <h2 className="text-sm font-bold uppercase tracking-wide text-navy-700 dark:text-slate-200">Fiches</h2>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher…"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-navy-400 dark:border-white/10 dark:bg-[#12161f] dark:text-slate-200"
            />
          </div>
          <ul className="max-h-[32rem] divide-y divide-slate-100 overflow-y-auto dark:divide-white/5">
            {filtered.map((c) => {
              const s = statsById.get(c.id);
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => setSel(c)}
                    aria-current={sel?.id === c.id ? "true" : undefined}
                    className={`flex w-full items-center gap-3 px-5 py-3 text-left transition-colors ${
                      sel?.id === c.id ? "bg-navy-50 dark:bg-white/10" : "hover:bg-slate-50 dark:hover:bg-white/5"
                    }`}
                  >
                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${toneOf(c.id)}`}>
                      {initials(c.full_name || c.email)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-slate-800 dark:text-slate-200">{c.full_name || c.email}</span>
                      <span className="block truncate text-xs text-slate-400">
                        {s?.requests ?? 0} demande{(s?.requests ?? 0) > 1 ? "s" : ""}
                        {s && s.revenue > 0 && <> · {money(s.revenue)}</>}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
            {filtered.length === 0 && <li className="px-5 py-8 text-center text-xs text-slate-400">Aucune fiche.</li>}
          </ul>
        </div>

        {/* Détail fiche */}
        {sel ? (
          <div className="space-y-6">
            <div className="card-pro overflow-hidden">
              <div className="flex flex-wrap items-center gap-4 border-b border-slate-100 px-5 py-5 dark:border-white/10">
                <span className={`flex h-14 w-14 items-center justify-center rounded-full text-base font-bold text-white ${toneOf(sel.id)}`}>
                  {initials(sel.full_name || sel.email)}
                </span>
                <div className="min-w-0">
                  <h2 className="font-display text-lg font-bold text-navy-900 dark:text-slate-100">{sel.full_name || sel.email}</h2>
                  <p className="text-sm text-slate-400">{sel.email}</p>
                </div>
                <div className="ml-auto flex gap-2">
                  <Link
                    href="/dashboard/admin/mailing"
                    className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-navy-700 hover:bg-navy-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10"
                  >
                    E-mail
                  </Link>
                </div>
              </div>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 px-5 py-4 text-sm sm:grid-cols-4">
                <Field label="Demandes" value={String(statsById.get(sel.id)?.requests ?? 0)} />
                <Field label="Devis acceptés" value={String(statsById.get(sel.id)?.quotesAccepted ?? 0)} />
                <Field label="CA encaissé" value={money(statsById.get(sel.id)?.revenue ?? 0)} />
                <Field label="Téléphone" value={sel.phone || "—"} />
                <Field label="Adresse" value={sel.address || "—"} wide />
              </dl>
            </div>

            {/* Note */}
            <div className="card-pro overflow-hidden">
              <div className="border-b border-slate-100 px-5 py-4 dark:border-white/10">
                <h2 className="text-sm font-bold uppercase tracking-wide text-navy-700 dark:text-slate-200">Nouvelle interaction</h2>
              </div>
              <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-stretch">
                <select
                  value={noteKind}
                  onChange={(e) => setNoteKind(e.target.value as CrmNote["kind"])}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm dark:border-white/10 dark:bg-[#12161f] dark:text-slate-200 sm:w-36"
                >
                  <option value="note">Note</option>
                  <option value="call">Appel</option>
                  <option value="email">E-mail</option>
                </select>
                <input
                  type="text"
                  value={noteDraft}
                  onChange={(e) => setNoteDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") void addNote(); }}
                  maxLength={2000}
                  placeholder="Compte rendu, relance, remarque…"
                  className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-navy-400 dark:border-white/10 dark:bg-[#12161f] dark:text-slate-200"
                />
                <button
                  type="button"
                  onClick={() => void addNote()}
                  disabled={!noteDraft.trim() || savingNote}
                  className="rounded-xl bg-navy-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-navy-800 disabled:opacity-40"
                >
                  {savingNote ? "…" : "Enregistrer"}
                </button>
              </div>
            </div>

            {/* Timeline */}
            <div className="card-pro overflow-hidden">
              <div className="border-b border-slate-100 px-5 py-4 dark:border-white/10">
                <h2 className="text-sm font-bold uppercase tracking-wide text-navy-700 dark:text-slate-200">Historique</h2>
              </div>
              {timeline(sel.id).length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-slate-400">Aucune activité enregistrée.</p>
              ) : (
                <ol className="divide-y divide-slate-100 dark:divide-white/5">
                  {timeline(sel.id).map((e, i) => (
                    <li key={`${e.kind}-${e.date}-${i}`} className="flex gap-3 px-5 py-3">
                      <span className={`mt-0.5 h-fit shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold lowercase ${KIND_STYLES[e.kind]}`}>
                        {KIND_LABELS[e.kind]}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="whitespace-pre-wrap break-words text-sm text-slate-700 dark:text-slate-300">{e.body}</p>
                        <p className="mt-0.5 text-xs text-slate-400">
                          {new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(new Date(e.date))}
                          {e.status === "failed" && <span className="ml-2 font-semibold text-red-600">échec d&apos;envoi</span>}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>
        ) : (
          <div className="card-pro flex min-h-64 items-center justify-center p-8 text-center text-sm text-slate-400">
            Sélectionnez une fiche pour voir les détails, notes et historique.
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={wide ? "col-span-2" : undefined}>
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="truncate font-semibold text-navy-900 dark:text-slate-200">{value}</dd>
    </div>
  );
}

function statsByTotal(clients: Client[], stats: Map<string, { requests: number }>) {
  return clients.reduce((n, c) => n + (stats.get(c.id)?.requests ?? 0), 0);
}
