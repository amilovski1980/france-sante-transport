"use client";

import { useState } from "react";

export default function PayQuoteButton({
  quoteId,
  paid = false,
  className = "",
}: {
  quoteId: string;
  paid?: boolean;
  className?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pay() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/quote-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quote_id: quoteId }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.ok && data.url) {
        if (data.already) {
          window.location.href = data.url;
          return;
        }
        window.location.href = data.url;
        return;
      }
      setError(data.error ?? "Paiement indisponible");
      setBusy(false);
    } catch {
      setError("Erreur réseau");
      setBusy(false);
    }
  }

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => void pay()}
        disabled={busy || paid}
        className="inline-flex items-center gap-2 rounded-full bg-[#635bff] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_6px_18px_rgba(99,91,255,0.28)] transition hover:bg-[#7a73ff] disabled:opacity-50"
      >
        <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
          <rect x="2.5" y="4.5" width="15" height="11" rx="2" />
          <path d="M2.5 8h15" strokeLinecap="round" />
        </svg>
        {paid ? "Devis réglé" : busy ? "Redirection…" : "Payer par carte"}
      </button>
      {error && <p className="mt-2 text-xs font-semibold text-red-600">{error}</p>}
    </div>
  );
}
