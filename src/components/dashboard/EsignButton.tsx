"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toUserMessage } from "@/lib/errors";
import type { EsignStatus } from "@/lib/types";

/**
 * Boutons DocuSign (staff seulement) : « ✍️ Signature DocuSign »
 * ouvre l'URL de signature intégrée dans un nouvel onglet ; le statut
 * s'affiche à côté (sent → delivered/completed via « Persona »).
 */
export default function EsignButton({
  quoteId,
  status,
  envelopeId,
  esignId,
}: {
  quoteId: string;
  status: EsignStatus | null;
  envelopeId: string | null;
  esignId: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<"create" | "check" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    setBusy("create");
    setError(null);
    try {
      const res = await fetch("/api/esign/envelope", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quote_id: quoteId }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error ?? "Envoi impossible");
      } else if (data.signing_url) {
        window.open(data.signing_url, "_blank", "noopener,width=1000,height=800");
        router.refresh();
      }
    } catch (err) {
      setError(toUserMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function refresh() {
    if (!esignId) return;
    setBusy("check");
    setError(null);
    try {
      const res = await fetch(`/api/esign/check/${esignId}`, { cache: "no-store" });
      const data = await res.json();
      if (!data.ok) setError(data.error ?? "Vérification impossible");
      else {
        if (data.status !== status) router.refresh();
      }
    } catch (err) {
      setError(toUserMessage(err));
    } finally {
      setBusy(null);
    }
  }

  const TONE: Record<EsignStatus, string> = {
    created: "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300",
    sent: "bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
    delivered: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
    completed: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
    declined: "bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300",
    voided: "bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-400",
  };

  return (
    <div className="print:hidden">
      <div className="flex flex-wrap gap-2">
        <a
          href={`/api/esign/quote/${quoteId}/pdf`}
          target="_blank"
          rel="noopener"
          className="rounded-full border border-navy-200 px-5 py-2.5 text-sm font-semibold text-navy-700 hover:bg-navy-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10"
        >
          ⬇️ PDF du devis
        </a>
        <button
          type="button"
          onClick={() => void send()}
          disabled={busy !== null}
          className="rounded-full bg-navy-800 px-5 py-2.5 text-sm font-semibold text-white hover:bg-navy-700 disabled:opacity-40"
        >
          {busy === "create" ? "⏳ Ouverture…" : "✍️ Signature DocuSign"}
        </button>
        {status && status !== "voided" && (
          <>
            <span className={`rounded-full px-3 py-2.5 text-xs font-bold uppercase ${TONE[status]}`}>Signature : {status}</span>
            {status !== "completed" && status !== "declined" && (
              <button
                type="button"
                onClick={() => void refresh()}
                disabled={busy !== null}
                className="rounded-full border border-navy-200 px-4 py-2.5 text-xs font-semibold text-navy-700 hover:bg-navy-50 disabled:opacity-40 dark:border-white/10 dark:text-slate-200"
              >
                {busy === "check" ? "⏳" : "🔄"}
              </button>
            )}
          </>
        )}
      </div>
      {error && <p className="mt-2 text-xs font-semibold text-red-600">{error}</p>}
    </div>
  );
}
