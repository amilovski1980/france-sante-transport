"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { AppRole, InternalMessage, Profile } from "@/lib/types";

type Counterpart = Pick<Profile, "id" | "full_name" | "email" | "role" | "avatar_url">;

const ROLE_LABELS: Record<AppRole, string> = {
  admin: "Administration",
  dispatcher: "Dispatch",
  driver: "Chauffeur",
  client: "Client",
  partner: "Partenaire",
  supplier: "Fournisseur",
};

const ROLE_BADGES: Record<AppRole, string> = {
  admin: "bg-navy-50 text-navy-700 dark:bg-white/10 dark:text-slate-200",
  dispatcher: "bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  driver: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  client: "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300",
  partner: "bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
  supplier: "bg-teal-50 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300",
};

const AVATAR_TONES = ["bg-navy-600", "bg-flagred-600", "bg-emerald-600", "bg-amber-600", "bg-blue-600"];

function nameOf(p: Counterpart) {
  return p.full_name || p.email;
}

function initials(p: Counterpart) {
  const name = nameOf(p);
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() || "?";
}

function toneOf(id: string) {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return AVATAR_TONES[h % AVATAR_TONES.length];
}

function timeLabel(iso: string) {
  return new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

function dayLabel(iso: string) {
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "full" }).format(new Date(iso));
}

export default function InternalMessages({ counterparts }: { counterparts: Counterpart[] }) {
  const supabase = useMemo(() => createClient(), []);
  const [meId, setMeId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(counterparts[0]?.id ?? null);
  const [threads, setThreads] = useState<Record<string, InternalMessage[]>>({});
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const threadEndRef = useRef<HTMLDivElement | null>(null);
  const listEndRef = useRef<HTMLDivElement | null>(null);

  const upsertMany = useCallback((incoming: InternalMessage[]) => {
    setThreads((prev) => {
      const next = { ...prev };
      for (const m of incoming) {
        const key = m.sender_id === meId ? m.recipient_id : m.sender_id;
        if (!key) continue;
        const bucket = next[key] ?? [];
        if (!bucket.some((x) => x.id === m.id)) bucket.push(m);
        next[key] = bucket.sort((a, b) => a.created_at.localeCompare(b.created_at));
      }
      return next;
    });
  }, [meId]);

  // Chargement initial : qui suis-je + messages visibles
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => {
      const [{ data: auth }]: [
        { data: { user: { id: string } | null } },
      ] = [await supabase.auth.getUser()];
      if (cancelled) return;
      const me = auth?.user?.id ?? null;
      setMeId(me);

      if (me) {
        const { data } = await supabase
          .from("internal_messages")
          .select("*")
          .order("created_at", { ascending: true })
          .limit(500);
        if (!cancelled) {
          upsertMany((data ?? []) as InternalMessage[]);
          setLoading(false);
        }
      } else if (!cancelled) {
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [supabase, upsertMany]);

  // Realtime : nouveaux messages (RLS filtre côté serveur)
  useEffect(() => {
    const channel = supabase
      .channel("internal-messages")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "internal_messages" },
        (payload) => {
          const row = payload.new as InternalMessage;
          // Non lu tant que l'utilisateur n'a pas ouvert le fil (badge + alerte).
          upsertMany([row]);
        },
      )
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [supabase, meId, upsertMany]);

  // Sélection automatique du contact avec le dernier message
  useEffect(() => {
    if (selectedId || counterparts.length === 0) return;
    let best: string | null = null;
    let bestTs = "";
    for (const p of counterparts) {
      const last = threads[p.id]?.at(-1);
      if (last && last.created_at >= bestTs) { best = p.id; bestTs = last.created_at; }
    }
    setSelectedId(best ?? counterparts[0].id);
  }, [counterparts, threads, selectedId]);

  const selected = counterparts.find((p) => p.id === selectedId) ?? null;
  const ordered = useMemo(
    () => [...counterparts].sort((a, b) => {
      const ta = threads[a.id]?.at(-1)?.created_at ?? "";
      const tb = threads[b.id]?.at(-1)?.created_at ?? "";
      return tb.localeCompare(ta);
    }),
    [counterparts, threads],
  );

  const unreadCount = (id: string) =>
    (threads[id] ?? []).filter((m) => m.recipient_id === meId && !m.read_at).length;

  const thread = selectedId ? threads[selectedId] ?? [] : [];

  // Marquer comme lu à l'ouverture du fil
  useEffect(() => {
    if (!meId || !selectedId) return;
    const unread = thread.filter((m) => m.recipient_id === meId && !m.read_at);
    if (unread.length === 0) return;
    void supabase
      .from("internal_messages")
      .update({ read_at: new Date().toISOString() })
      .in("id", unread.map((m) => m.id))
      .then(() => {
        setThreads((prev) => ({
          ...prev,
          [selectedId]: (prev[selectedId] ?? []).map((m) =>
            unread.some((u) => u.id === m.id) ? { ...m, read_at: m.read_at ?? new Date().toISOString() } : m,
          ),
        }));
      });
  }, [supabase, meId, selectedId, thread]);

  // Défilement auto en bas du fil
  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ block: "end" });
  }, [thread.length, selectedId]);

  async function send() {
    if (!meId || !selectedId || !draft.trim() || sending) return;
    setSending(true);
    setError(null);
    const body = draft.trim();
    const { data, error: err } = await supabase
      .from("internal_messages")
      .insert({ sender_id: meId, recipient_id: selectedId, body })
      .select()
      .single();
    setSending(false);
    if (err) { setError("Envoi impossible : " + err.message); return; }
    setDraft("");
    upsertMany([data as InternalMessage]);
    // Alerter le destinataire (in-app + Web Push), sans bloquer l'UI.
    void fetch("/api/messages/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message_id: (data as { id: string }).id }),
    }).catch(() => undefined);
  }

  const empty = !loading && counterparts.length === 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-display text-2xl font-semibold text-navy-900 dark:text-slate-100">Messagerie interne</h1>
        <span className="text-xs text-slate-400">Chauffeurs · Dispatch · Administration</span>
      </div>

      {empty ? (
        <div className="card-pro p-8 text-center">
          <p className="text-sm text-slate-500">Aucun interlocuteur disponible.</p>
        </div>
      ) : (
        <div className="card-pro overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-[16rem_1fr] md:divide-x md:divide-slate-100 dark:md:divide-white/5">
            {/* Liste des contacts */}
            <div className={`max-h-48 overflow-y-auto border-b border-slate-100 md:max-h-none md:border-b-0 dark:border-white/5 ${selectedId ? "hidden md:block" : ""}`}>
              {ordered.map((p) => {
                const unread = unreadCount(p.id);
                const last = threads[p.id]?.at(-1);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => { setSelectedId(p.id); listEndRef.current?.scrollIntoView(); }}
                    aria-current={p.id === selectedId ? "true" : undefined}
                    className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ${
                      p.id === selectedId
                        ? "bg-navy-50 dark:bg-white/10"
                        : "hover:bg-slate-50 dark:hover:bg-white/5"
                    }`}
                  >
                    <span className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${toneOf(p.id)}`}>
                      {initials(p)}
                      {unread > 0 && (
                        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-flagred-600 px-1 text-[10px] font-bold text-white">
                          {unread}
                        </span>
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-semibold text-slate-800 dark:text-slate-200">{nameOf(p)}</span>
                        {last && <span className="shrink-0 text-[10px] text-slate-400">{timeLabel(last.created_at)}</span>}
                      </span>
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate text-xs text-slate-400">{last ? last.body.slice(0, 30) : ROLE_LABELS[p.role]}</span>
                        <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-bold text-slate-500 ${ROLE_BADGES[p.role]}`}>{ROLE_LABELS[p.role]}</span>
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Fil de conversation */}
            <div className="flex min-h-[24rem] flex-col">
              {selected ? (
                <>
                  <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3 dark:border-white/5">
                    <button type="button" onClick={() => setSelectedId(null)} className="rounded-lg px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-100 md:hidden dark:hover:bg-white/10">← Retour</button>
                    <span className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-white ${toneOf(selected.id)}`}>{initials(selected)}</span>
                    <div>
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{nameOf(selected)}</p>
                      <p className="text-[11px] text-slate-400">{ROLE_LABELS[selected.role]}</p>
                    </div>
                  </div>

                  <div className="dash-bg min-h-40 flex-1 space-y-1 overflow-y-auto p-4">
                    {loading && <p className="text-center text-xs text-slate-400">Chargement…</p>}
                    {!loading && thread.length === 0 && (
                      <p className="py-8 text-center text-xs text-slate-400">
                        Aucun message. Exprimez-vous en premier — le message apparaît immédiatement des deux côtés.
                      </p>
                    )}
                    {thread.map((m, i) => {
                      const prev = thread[i - 1];
                      const newDay =
                        !prev || new Date(prev.created_at).toDateString() !== new Date(m.created_at).toDateString();
                      const mine = m.sender_id === meId;
                      return (
                        <div key={m.id}>
                          {newDay && (
                            <p className="py-2 text-center text-[10px] uppercase tracking-wider text-slate-400">{dayLabel(m.created_at)}</p>
                          )}
                          {!newDay && prev && prev.sender_id === m.sender_id && new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() > 5 * 60_000 && (
                            <div className="h-2" />
                          )}
                          <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                            <div
                              className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm ${
                                mine
                                  ? "rounded-br-sm bg-navy-700 text-white"
                                  : "rounded-bl-sm border border-slate-200 bg-white text-slate-800 shadow-sm dark:border-white/10 dark:bg-[#161b26] dark:text-slate-200"
                              }`}
                            >
                              <p className="whitespace-pre-wrap break-words">{m.body}</p>
                              <p className={`mt-1 text-right text-[10px] ${mine ? "text-white/60" : "text-slate-400"}`}>
                                {timeLabel(m.created_at)}
                                {mine && m.read_at && " ✓✓"}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={threadEndRef} />
                  </div>

                  <form
                    className="flex items-end gap-2 border-t border-slate-100 p-3 dark:border-white/5"
                    onSubmit={(e) => { e.preventDefault(); void send(); }}
                  >
                    <textarea
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); }
                      }}
                      rows={1}
                      maxLength={2000}
                      placeholder={`Message à ${nameOf(selected)}…`}
                      className="max-h-32 flex-1 resize-none rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800 outline-none focus:border-navy-400 dark:border-white/10 dark:bg-[#12161f] dark:text-slate-200"
                    />
                    <button
                      type="submit"
                      disabled={!draft.trim() || sending}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-navy-700 text-white transition-colors hover:bg-navy-800 disabled:opacity-40"
                      aria-label="Envoyer"
                    >
                      {sending ? (
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                      ) : (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></svg>
                      )}
                    </button>
                  </form>
                  {error && <p className="px-4 pb-3 text-xs text-flagred-600">{error}</p>}
                </>
              ) : (
                <div className="flex flex-1 items-center justify-center p-8 text-center text-sm text-slate-400">
                  Choisissez un interlocuteur.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      <div ref={listEndRef} />
    </div>
  );
}
