"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

export default function EsignDonePage() {
  const search = useSearchParams();
  const router = useRouter();
  const esignId = search.get("esign");
  const [status, setStatus] = useState<"checking" | "completed" | "pending" | "error">("checking");
  const [message, setMessage] = useState("Vérification de la signature…");

  useEffect(() => {
    if (!esignId) {
      setStatus("error");
      setMessage("Lien incomplet — revenez au devis et ouvrez le lien de signature depuis celui-ci.");
      return;
    }
    void (async () => {
      try {
        const res = await fetch(`/api/esign/check/${esignId}`, { cache: "no-store" });
        const data = await res.json();
        if (!data.ok) {
          setStatus("error");
          setMessage(data.error ?? "Vérification impossible");
          return;
        }
        if (data.status === "completed") {
          setStatus("completed");
          setMessage("Signature enregistrée ✓ Le PDF signé est archivé dans le dossier.");
        } else if (data.status === "declined") {
          setStatus("error");
          setMessage("Le destinataire a refusé de signer l'enveloppe.");
        } else {
          setStatus("pending");
          setMessage(`Statut : ${data.status}. Si vous venez de signer, patientez quelques secondes puis rouvrez cette page.`);
        }
      } catch {
        setStatus("error");
        setMessage("Erreur réseau lors de la vérification");
      }
    })();
  }, [esignId]);

  return (
    <div className="mx-auto mt-16 w-full max-w-lg">
      <div className="card-pro p-8 text-center">
        <p className="text-4xl">{status === "completed" ? "✅" : status === "pending" ? "⏳" : "⚠️"}</p>
        <h1 className="mt-3 font-display text-xl font-semibold text-navy-900 dark:text-slate-100">
          {status === "completed" ? "Signature terminée" : status === "pending" ? "Signature en cours" : "Problème de signature"}
        </h1>
        <p className="mt-2 text-sm text-slate-500">{message}</p>
        <div className="mt-6 flex justify-center gap-3">
          {configureButton()}
          <Link
            href="/dashboard"
            className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300"
          >
            Accueil
          </Link>
        </div>
      </div>
    </div>
  );

  function configureButton() {
    if (status === "pending" && esignId) {
      return (
        <button
          type="button"
          onClick={() => {
            setStatus("checking");
            setMessage("Vérification de la signature…");
            router.refresh();
            void fetch(`/api/esign/check/${esignId}`, { cache: "no-store" })
              .then((r) => r.json())
              .then((d) => {
                if (d.ok && d.status === "completed") {
                  setStatus("completed");
                  setMessage("Signature enregistrée ✓ Le PDF signé est archivé dans le dossier.");
                } else if (d.ok) {
                  setStatus("pending");
                  setMessage(`Statut : ${d.status}`);
                } else {
                  setStatus("error");
                  setMessage(d.error ?? "Vérification impossible");
                }
              });
          }}
          className="rounded-xl bg-navy-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-navy-800"
        >
          🔄 Revérifier
        </button>
      );
    }
    return null;
  }
}
