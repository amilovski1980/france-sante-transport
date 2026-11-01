"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toUserMessage } from "@/lib/errors";
import type { EsignStatus } from "@/lib/types";

const TONE: Record<EsignStatus, string> = {
  created: "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300",
  sent: "bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  delivered: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  completed: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  declined: "bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300",
  voided: "bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-400",
};

const STATUS_LABEL: Record<EsignStatus, string> = {
  created: "préparée",
  sent: "envoyée",
  delivered: "à signer",
  completed: "signée",
  declined: "refusée",
  voided: "annulée",
};

export default function EsignButton({
  quoteId,
  status,
  esignId,
  audience = "staff",
}: {
  quoteId: string;
  status: EsignStatus | null;
  envelopeId?: string | null;
  esignId: string | null;
  audience?: "staff" | "client";
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<"create" | "check" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function openSignature() {
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
        setError(data.error ?? "Ouverture impossible");
      } else if (data.signing_url) {
        const opened = window.open(data.signing_url, "_blank", "noopener,width=1000,height=800");
        if (!opened) window.location.href = data.signing_url;
        router.refresh();
      }
    } catch (err) {
      setError(toUserMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function refreshStatus() {
    if (!esignId) return;
    setBusy("check");
    setError(null);
    try {
      const res = await fetch(`/api/esign/check/${esignId}`, { cache: "no-store" });
      const data = await res.json();
      if (!data.ok) setError(data.error ?? "Vérification impossible");
      else if (data.status !== status) router.refresh();
    } catch (err) {
      setError(toUserMessage(err));
    } finally {
      setBusy(null);
    }
  }

  const signed = status === "completed";

  return (
    <div className="print:hidden">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void openSignature()}
          disabled={busy !== null || signed}
          className="inline-flex items-center gap-2 rounded-full bg-navy-800 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-navy-700 disabled:opacity-40"
        >
          <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M3 14.5c2.8-1.2 4.2-3 4.9-6.1.3-1.4 1.9-1.6 2.3-.2.4 1.5-.7 3.5.9 3.9 1 .3 1.8-.6 2.4-1.9.4-.9 1.6-.7 1.8.2.2 1 .8 1.6 2.7 1.6" strokeLinecap="round" />
            <path d="M3 17h14" strokeLinecap="round" />
          </svg>
          {busy === "create"
            ? "Ouverture…"
            : signed
              ? "Devis signé"
              : audience === "client"
                ? "Signer le devis"
                : "Signature DocuSign"}
        </button>

        {status && status !== "voided" && (
          <>
            <span className={`rounded-full px-3 py-2 text-xs font-bold uppercase tracking-wide ${TONE[status]}`}>
              Signature {STATUS_LABEL[status]}
            </span>
            {!signed && status !== "declined" && esignId && (
              <button
                type="button"
                onClick={() => void refreshStatus()}
                disabled={busy !== null}
                className="rounded-full border border-navy-200 px-4 py-2.5 text-xs font-semibold text-navy-700 hover:bg-navy-50 disabled:opacity-40 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10"
              >
                {busy === "check" ? "Vérification…" : "Actualiser"}
              </button>
            )}
          </>
        )}
      </div>
      {error && <p className="mt-2 text-xs font-semibold text-red-600">{error}</p>}
    </div>
  );
}
