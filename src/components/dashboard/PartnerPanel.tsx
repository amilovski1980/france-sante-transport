"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toUserMessage } from "@/lib/errors";
import type { AppRole, ContactMessage, Profile } from "@/lib/types";

type PartnerRow = ContactMessage & { partner?: Pick<Profile, "id" | "full_name" | "email"> | null };

type Referral = {
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  organization: string;
  pickup: string;
  dropoff: string;
  need: string;
};

const EMPTY: Referral = {
  contact_name: "",
  contact_email: "",
  contact_phone: "",
  organization: "",
  pickup: "",
  dropoff: "",
  need: "",
};

export default function PartnerPanel({ role, partnerName }: { role: AppRole; partnerName: string }) {
  const isPartner = role === "partner";
  const isStaff = role === "admin" || role === "dispatcher";
  const [rows, setRows] = useState<PartnerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Referral>(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const base = supabase
      .from("contact_messages")
      .select("*, partner:profiles!contact_messages_partner_id_fkey(id, full_name, email)")
      .eq("topic", "referral")
      .order("created_at", { ascending: false })
      .limit(50);
    const { data } = await base;
    setRows((data ?? []) as PartnerRow[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function field<K extends keyof Referral>(key: K, value: string) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setInfo(null);
    try {
      const res = await fetch("/api/partner/referrals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error ?? "Envoi impossible");
      } else {
        setDraft(EMPTY);
        setInfo("Dossier transmis ✓ Le dispatch entre en contact avec votre client et vous informe du suivi.");
        await load();
      }
    } catch (err) {
      setError(toUserMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleHandled(row: PartnerRow) {
    setProcessingId(row.id);
    setError(null);
    try {
      const supabase = createClient();
      const { error: err } = await supabase
        .from("contact_messages")
        .update({ handled: !row.handled })
        .eq("id", row.id);
      if (err) setError(toUserMessage(err));
      else setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, handled: !row.handled } : r)));
    } finally {
      setProcessingId(null);
    }
  }

  const handledCount = rows.filter((r) => r.handled).length;
  const pendingCount = rows.length - handledCount;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-navy-900 dark:text-slate-100">Apports d&apos;affaires</h1>
          <p className="mt-1 text-sm text-slate-400">
            {isPartner
              ? `${partnerName} — transmettez un dossier, nous l'instruisons avec vous.`
              : "Dossiers transmis par le réseau de partenaires."}
          </p>
        </div>
        <div className="flex gap-2">
          <span className="rounded-xl bg-navy-50 px-4 py-2 text-sm font-semibold text-navy-800 dark:bg-white/10 dark:text-slate-200">
            Total : {rows.length}
          </span>
          <span className="rounded-xl bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
            En cours : {pendingCount}
          </span>
          <span className="rounded-xl bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
            Instruits : {handledCount}
          </span>
        </div>
      </div>

      {error && <div className="card-pro px-5 py-3 text-sm font-semibold text-red-600">{error}</div>}
      {info && !error && (
        <div className="card-pro px-5 py-3 text-sm font-semibold text-emerald-700 dark:text-emerald-300">{info}</div>
      )}

      {/* Formulaire partenaire */}
      {isPartner && (
        <form onSubmit={submit} className="card-pro overflow-visible">
          <div className="border-b border-slate-100 px-5 py-4 dark:border-white/10">
            <h2 className="text-sm font-bold uppercase tracking-wide text-navy-700 dark:text-slate-200">Transmettre un dossier</h2>
          </div>
          <div className="grid grid-cols-1 gap-4 px-5 py-4 sm:grid-cols-2">
            <F label="Nom du contact client *">
              <input required minLength={2} value={draft.contact_name} onChange={(e) => field("contact_name", e.target.value)} placeholder="Mme Dupont" className={inputCls} />
            </F>
            <F label="E-mail du contact *">
              <input type="email" required value={draft.contact_email} onChange={(e) => field("contact_email", e.target.value)} placeholder="contact@exemple.fr" className={inputCls} />
            </F>
            <F label="Téléphone">
              <input value={draft.contact_phone} onChange={(e) => field("contact_phone", e.target.value)} placeholder="06 …" className={inputCls} />
            </F>
            <F label="Structure / établissement">
              <input value={draft.organization} onChange={(e) => field("organization", e.target.value)} placeholder="Clinique, cabinet, EHPAD…" className={inputCls} />
            </F>
            <F label="Départ souhaité">
              <input value={draft.pickup} onChange={(e) => field("pickup", e.target.value)} placeholder="Adresse d'enlèvement" className={inputCls} />
            </F>
            <F label="Destination">
              <input value={draft.dropoff} onChange={(e) => field("dropoff", e.target.value)} placeholder="Adresse d'arrivée" className={inputCls} />
            </F>
            <div className="sm:col-span-2">
              <F label="Besoin du client *">
                <textarea required minLength={10} rows={3} value={draft.need} onChange={(e) => field("need", e.target.value)} placeholder="Ex. : 30 échantillons UN 3373 à 2–8 °C, laboratoire X → centre de biologie Y, collecte jeudi matin…" className={`${inputCls} resize-y`} />
              </F>
            </div>
          </div>
          <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-5 py-4 dark:border-white/10">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-xl bg-navy-700 px-6 py-2.5 text-sm font-semibold text-white hover:bg-navy-800 disabled:opacity-40"
            >
              {submitting ? "Transmission…" : "Transmettre au dispatch"}
            </button>
          </div>
        </form>
      )}

      {/* Liste */}
      <div className="card-pro overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-white/10">
          <h2 className="text-sm font-bold uppercase tracking-wide text-navy-700 dark:text-slate-200">
            {isStaff ? "Dossiers partenaires" : "Mes apports"}
          </h2>
          {isStaff && <span className="text-xs text-slate-400">Cliquez « Instruit » quand le contact est pris</span>}
        </div>
        {loading ? (
          <p className="px-5 py-8 text-center text-sm text-slate-400">Chargement…</p>
        ) : rows.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-slate-400">
            {isPartner ? "Aucun apport pour le moment — utilisez le formulaire de transmission ci-dessus." : "Aucun apport d'affaires reçu."}
          </p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-white/5">
            {rows.map((r) => (
              <li key={r.id} className="px-5 py-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-200">
                      {r.full_name}
                      {r.partner && <span className="ml-2 text-xs font-medium text-slate-400">· via {r.partner.full_name || r.partner.email}</span>}
                    </p>
                    <p className="text-xs text-slate-400">
                      {r.email}{r.phone ? ` · ${r.phone}` : ""} · {new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(new Date(r.created_at))}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
                        r.handled
                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                          : "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
                      }`}
                    >
                      {r.handled ? "INSTRUIT" : "NOUVEAU"}
                    </span>
                    {isStaff && (
                      <button
                        type="button"
                        disabled={processingId === r.id}
                        onClick={() => void toggleHandled(r)}
                        className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-navy-700 hover:bg-slate-50 disabled:opacity-40 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10"
                      >
                        {r.handled ? "↩ Réouvrir" : "✓ Instruit"}
                      </button>
                    )}
                  </div>
                </div>
                <p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-600 dark:text-slate-300">{r.message}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

const inputCls =
  "mt-1 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-navy-400 dark:border-white/10 dark:bg-[#12161f] dark:text-slate-200";

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</label>
      {children}
    </div>
  );
}
