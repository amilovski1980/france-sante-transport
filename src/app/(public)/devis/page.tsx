import type { Metadata } from "next";
import RequestForm from "@/components/RequestForm";
import { getLocale } from "@/lib/i18n/server";
import type { Locale } from "@/lib/i18n/locale";

export const metadata: Metadata = {
  title: "Demande de devis",
  description:
    "Décrivez votre besoin de transport : nos équipes instruisent la demande et vous adressent un devis versionné.",
};

const COPY = {
  fr: {
    kicker: "Demande de devis",
    title: "Décrivez votre transport",
    intro:
      "Votre demande est enregistrée dans votre espace, horodatée, puis examinée par nos équipes. Vous recevrez un devis à valider — rien n'est engagé sans votre accord.",
    howTitle: "Comment ça se passe ?",
    steps: [
      "Vous soumettez la demande depuis votre compte.",
      "Nos équipes l'instruisent et préparent un devis versionné.",
      "Vous consultez et acceptez la version qui vous est envoyée.",
      "La mission est confirmée par nos équipes avant d'être engagée.",
    ],
    talkTitle: "Besoin d'en discuter ?",
    talkBody: "Nos équipes répondent via la page contact, du lundi au vendredi.",
    talkLink: "Contacter l'équipe →",
  },
  en: {
    kicker: "Quote request",
    title: "Describe your transport",
    intro:
      "Your request is recorded in your space, timestamped, then reviewed by our teams. You will receive a quote to approve — nothing is committed without your agreement.",
    howTitle: "How it works",
    steps: [
      "You submit the request from your account.",
      "Our teams review it and prepare a versioned quote.",
      "You review and accept the version sent to you.",
      "The mission is confirmed by our teams before any commitment.",
    ],
    talkTitle: "Want to talk it through?",
    talkBody: "Our teams answer through the contact page, Monday to Friday.",
    talkLink: "Contact the team →",
  },
} as const satisfies Record<Locale, Record<string, string | readonly string[]>>;

export default async function QuoteRequestPage() {
  const locale = await getLocale();
  const c = COPY[locale];

  return (
    <>
      <section className="bg-navy-900 py-20 text-white">
        <div className="container-x max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-flagred-500">
            {c.kicker}
          </p>
          <h1 className="mt-3 font-display text-4xl font-semibold sm:text-5xl">{c.title}</h1>
          <p className="mt-5 text-lg leading-relaxed text-navy-100/90">{c.intro}</p>
        </div>
      </section>

      <section className="section-pad bg-navy-50/60">
        <div className="container-x grid gap-10 lg:grid-cols-[1.3fr_0.7fr] lg:items-start">
          <RequestForm />

          <aside className="space-y-5">
            <div className="surface p-6">
              <h2 className="font-display text-lg font-semibold text-navy-900">{c.howTitle}</h2>
              <ol className="mt-4 space-y-4 text-sm text-navy-700/85">
                {c.steps.map((step, index) => (
                  <li key={step} className="flex gap-3">
                    <span className="font-display font-bold text-flagred-600">{index + 1}</span>
                    {step}
                  </li>
                ))}
              </ol>
            </div>

            <div className="rounded-xl border border-navy-100 bg-white p-6">
              <p className="text-sm leading-relaxed text-navy-700/80">
                <span className="font-semibold text-navy-900">{c.talkTitle}</span> {c.talkBody}
              </p>
              <a
                href="/contact"
                className="mt-4 inline-flex text-sm font-semibold text-navy-800 underline decoration-flagred-600 decoration-2 underline-offset-4"
              >
                {c.talkLink}
              </a>
            </div>
          </aside>
        </div>
      </section>
    </>
  );
}
