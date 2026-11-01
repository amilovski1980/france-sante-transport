"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Bouton « Payer avec Stripe » pour le client propriétaire d'une facture.
 * Après retour de Stripe Checkout (?session_id=…), la session est vérifiée
 * côté serveur (POST /api/stripe/confirm) puis la page est rafraîchie.
 */
export default function PayInvoiceButton({ invoiceId }: { invoiceId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Confirmation automatique au retour de Stripe.
  const confirming = useRef(false);
  useEffect(() => {
    const sessionId = searchParams.get("session_id");
    if (!sessionId || confirming.current) return;
    confirming.current = true;
    const supabase = supabaseRef.current ?? (supabaseRef.current = createClient());
    (async () => {
      const res = await fetch("/api/stripe/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoice_id: invoiceId, session_id: sessionId }),
      });
      const data = await res.json().catch(() => ({}));
      // Nettoie l'URL puis rafraîchit.
      window.history.replaceState({}, "", `/dashboard/invoices/${invoiceId}`);
      if (data.ok) {
        router.refresh();
      } else {
        setError(data.error ?? "Confirmation du paiement impossible");
      }
    })();
  }, [invoiceId, searchParams, router]);

  async function pay() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoice_id: invoiceId }),
      });
      const data = await res.json();
      if (data.ok && data.url) {
        window.location.href = data.url;
      } else {
        setError(data.error ?? "Paiement indisponible");
        setBusy(false);
      }
    } catch {
      setError("Erreur réseau");
      setBusy(false);
    }
  }

  return (
    <div className="print:hidden">
      {error && (
        <p className="mb-3 rounded-xl bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
          {error}
        </p>
      )}
      {searchParams.get("payment") === "canceled" && (
        <p className="mb-3 rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-600 dark:bg-white/5 dark:text-slate-300">
          Paiement annulé — la facture reste due. Vous pouvez réessayer quand vous voulez.
        </p>
      )}
      <button
        type="button"
        onClick={() => void pay()}
        disabled={busy}
        className="flex w-full items-center justify-center gap-3 rounded-xl bg-[#635bff] px-6 py-3.5 text-base font-bold text-white shadow-[0_8px_24px_rgba(99,91,255,0.35)] transition-colors hover:bg-[#7a73ff] disabled:opacity-40 sm:w-auto"
      >
        {busy ? "Redirection vers Stripe…" : "Payer avec Stripe"}
      </button>
      <p className="mt-2 text-center text-xs text-slate-400 sm:text-left">Paiement sécurisé par carte bancaire — confirmation immédiate.</p>
    </div>
  );
}
