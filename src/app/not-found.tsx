import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-navy-900 px-6 text-center text-white">
      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-navy-400">Erreur 404</p>
      <h1 className="font-display text-3xl font-bold">Page introuvable</h1>
      <p className="max-w-md text-sm text-navy-300">
        La page demandée n&apos;existe pas ou a été déplacée.
      </p>
      <Link
        href="/"
        className="mt-2 rounded-full bg-white px-6 py-2.5 text-sm font-semibold text-navy-900 transition hover:bg-navy-100"
      >
        Retour à l&apos;accueil
      </Link>
    </main>
  );
}
