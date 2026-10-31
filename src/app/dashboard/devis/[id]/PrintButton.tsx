"use client";

export default function PrintButton() {
  return (
    <div className="flex flex-wrap gap-3 print:hidden">
      <button
        type="button"
        onClick={() => window.print()}
        className="rounded-full bg-flagred-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-flagred-700"
      >
        Imprimer / PDF
      </button>
      <a
        href="/dashboard"
        className="rounded-full border border-navy-200 px-6 py-2.5 text-sm font-semibold text-navy-700 transition hover:bg-navy-50"
      >
        Retour au tableau de bord
      </a>
    </div>
  );
}
