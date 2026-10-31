"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { AppRole, EmailLog, Profile } from "@/lib/types";

type Recipient = Pick<Profile, "id" | "full_name" | "email" | "role" | "avatar_url">;

const SEGMENTS: Array<{ key: AppRole; label: string }> = [
  { key: "client", label: "Clients" },
  { key: "partner", label: "Partenaires" },
  { key: "driver", label: "Chauffeurs" },
  { key: "dispatcher", label: "Dispatch" },
];

const ROLE_LABELS: Record<AppRole, string> = {
  client: "Client",
  partner: "Partenaire",
  driver: "Chauffeur",
  dispatcher: "Dispatch",
  admin: "Administration",
};

const STATUS_STYLES: Record<EmailLog["status"], string> = {
  sent: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  failed: "bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300",
  queued: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
};

const STATUS_LABELS: Record<EmailLog["status"], string> = {
  sent: "Envoyé",
  failed: "Échec",
  queued: "En attente",
};

export default function MailingPanel({ recipients }: { recipients: Recipient[] }) {
  const supabase = useMemo(() => createClient(), []);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [roleFilter, setRoleFilter] = useState<AppRole | "all">("all");
  const [search, setSearch] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ sent: number; failed: number; raw?: string } | null>(null);
  const [history, setHistory] = useState<Array<EmailLog & { recipient?: Pick<Profile, "id" | "full_name" | "email"> }>>([]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return recipients.filter(
      (r) =>
        (roleFilter === "all" || r.role === roleFilter) &&
        (!q ||
          (r.full_name || "").toLowerCase().includes(q) ||
          r.email.toLowerCase().includes(q)),
    );
  }, [recipients, roleFilter, search]);

  const loadHistory = async () => {
    const { data } = await supabase
      .from("email_log")
      .select("*, recipient:profiles!email_log_recipient_id_fkey(id, full_name, email)")
      .order("created_at", { ascending: false })
      .limit(50);
    setHistory((data ?? []) as Array<EmailLog & { recipient?: Pick<Profile, "id" | "full_name" | "email"> }>);
  };

  useEffect(() => { void loadHistory(); /* eslint-disable-line react-hooks/exhaustive-deps */ }, []);

  const toggle = (id: string) =>
    setSel((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  async function send() {
    if (!subject.trim() || !body.trim() || sel.size === 0 || sending) return;
    setSending(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/mailing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipient_ids: Array.from(sel), subject, body }),
      });
      const data = await res.json();
      if (data.ok) {
        setResult({ sent: data.sent, failed: data.failed });
        setSubject("");
        setBody("");
        setSel(new Set());
        await loadHistory();
      } else {
        setResult({ sent: 0, failed: 0, raw: data.error || "Erreur inconnue" });
      }
    } catch (err) {
      setResult({ sent: 0, failed: 0, raw: err instanceof Error ? err.message : "Erreur réseau" });
    } finally {
      setSending(false);
    }
  }

  const total = sel.size;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-navy-900 dark:text-slate-100">Mailing</h1>
          <p className="mt-1 text-sm text-slate-400">E-mails groupés par segment — chaque envoi est journalisé dans l&apos;historique.</p>
        </div>
        <div className="rounded-xl bg-navy-50 px-4 py-2 text-sm font-semibold text-navy-800 dark:bg-white/10 dark:text-slate-200">
          {total} destinataire{total > 1 ? "s" : ""} sélectionné{total > 1 ? "s" : ""}
        </div>
      </div>

      {result && (
        <div className={`card-pro px-5 py-3 text-sm ${result.raw ? "text-red-600" : "text-slate-700 dark:text-slate-200"}`}>
          {result.raw ? (
            <p className="font-semibold">{result.raw}</p>
          ) : (
            <p>
              ✅ {result.sent} e-mail{result.sent > 1 ? "s" : ""} envoyé{result.sent > 1 ? "s" : ""}
              {result.failed > 0 && <span className="font-semibold text-red-600"> · {result.failed} en échec</span>}
            </p>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[20rem_1fr]">
        {/* Destinataires */}
        <div className="card-pro overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-4 dark:border-white/10">
            <h2 className="text-sm font-bold uppercase tracking-wide text-navy-700 dark:text-slate-200">Destinataires</h2>
          </div>
          <div className="flex flex-wrap gap-2 px-5 py-4">
            {SEGMENTS.map((s) => {
              const ids = recipients.filter((r) => r.role === s.key).map((r) => r.id);
              const all = ids.length > 0 && ids.every((id) => sel.has(id));
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() =>
                    setSel((prev) => {
                      const noneSelected = ids.every((id) => !prev.has(id));
                      const next = new Set(prev);
                      for (const id of ids) next[noneSelected ? "add" : "delete"](id);
                      return next;
                    })
                  }
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                    all
                      ? "border-navy-700 bg-navy-700 text-white"
                      : "border-slate-200 bg-white text-slate-600 hover:border-navy-300 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
                  }`}
                >
                  {s.label} ({ids.length})
                </button>
              );
            })}
          </div>
          <div className="px-5 pb-4">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un contact…"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-navy-400 dark:border-white/10 dark:bg-[#12161f] dark:text-slate-200"
            />
          </div>
          <ul className="max-h-80 divide-y divide-slate-100 overflow-y-auto dark:divide-white/5">
            {filtered.map((r) => (
              <li key={r.id}>
                <label className="flex cursor-pointer items-center gap-3 px-5 py-2.5 hover:bg-slate-50 dark:hover:bg-white/5">
                  <input
                    type="checkbox"
                    checked={sel.has(r.id)}
                    onChange={() => toggle(r.id)}
                    className="h-4 w-4 rounded border-slate-300 text-navy-700 focus:ring-navy-500"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-slate-800 dark:text-slate-200">{r.full_name || r.email}</span>
                    <span className="block truncate text-xs text-slate-400">{r.email}</span>
                  </span>
                  <span className="shrink-0 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-500 dark:bg-white/10 dark:text-slate-300">
                    {ROLE_LABELS[r.role]}
                  </span>
                </label>
              </li>
            ))}
            {filtered.length === 0 && <li className="px-5 py-6 text-center text-xs text-slate-400">Aucun contact.</li>}
          </ul>
        </div>

        {/* Rédaction */}
        <form
          className="card-pro overflow-hidden self-start"
          onSubmit={(e) => { e.preventDefault(); void send(); }}
        >
          <div className="border-b border-slate-100 px-5 py-4 dark:border-white/10">
            <h2 className="text-sm font-bold uppercase tracking-wide text-navy-700 dark:text-slate-200">Composer</h2>
          </div>
          <div className="space-y-4 px-5 py-4">
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              maxLength={200}
              required
              placeholder="Objet de l'e-mail…"
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold outline-none focus:border-navy-400 dark:border-white/10 dark:bg-[#12161f] dark:text-slate-200"
            />
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={5000}
              required
              rows={8}
              placeholder="Votre message… (les lignes vides séparent les paragraphes)"
              className="w-full resize-y rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-navy-400 dark:border-white/10 dark:bg-[#12161f] dark:text-slate-200"
            />
          </div>
          <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-5 py-4 dark:border-white/10">
            <button
              type="button"
              onClick={() => { setSubject(""); setBody(""); }}
              className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10"
            >
              Effacer
            </button>
            <button
              type="submit"
              disabled={total === 0 || !subject.trim() || !body.trim() || sending}
              className="rounded-xl bg-navy-700 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-navy-800 disabled:opacity-40"
            >
              {sending ? "Envoi…" : `Envoyer à ${total} destinataire${total > 1 ? "s" : ""}`}
            </button>
          </div>
        </form>
      </div>

      {/* Historique */}
      <div className="card-pro overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-white/10">
          <h2 className="text-sm font-bold uppercase tracking-wide text-navy-700 dark:text-slate-200">Historique des envois</h2>
          <button
            type="button"
            onClick={() => void loadHistory()}
            className="rounded-lg px-3 py-1.5 text-xs font-semibold text-navy-700 hover:bg-navy-50 dark:text-slate-300 dark:hover:bg-white/10"
          >
            Actualiser
          </button>
        </div>
        {history.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-slate-400">Aucun e-mail envoyé pour le moment.</p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-white/5">
            {history.map((h) => (
              <li key={h.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-200">{h.subject}</p>
                  <p className="truncate text-xs text-slate-400">
                    → {h.recipient?.full_name || h.to_email} · {new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(new Date(h.created_at))}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${STATUS_STYLES[h.status]}`}>{STATUS_LABELS[h.status]}</span>
                  {h.error && <span className="max-w-40 truncate text-xs text-slate-400" title={h.error}>{h.error}</span>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
