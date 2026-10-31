import type { Metadata } from "next";
import { Suspense } from "react";
import ContactForm from "@/components/ContactForm";
import { getLocale } from "@/lib/i18n/server";
import type { Locale } from "@/lib/i18n/locale";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Contactez les équipes France Santé Transport : questions, partenariats et demandes spécifiques.",
};

const COPY = {
  fr: {
    kicker: "Contact",
    title: "Parlons de votre besoin",
    intro:
      "Une question, un partenariat, un dossier particulier ? Écrivez-nous : votre message est enregistré et traité par nos équipes.",
    infoTitle: "Coordonnées",
    emailLabel: "E-mail",
    emailNote: "(provisoire)",
    hoursLabel: "Horaires",
    hours: "Équipe administrative : du lundi au vendredi, 9h — 18h",
    urgentLabel: "Urgences",
    urgent:
      "Ce service n'est pas un service d'urgence médicale. En cas d'urgence, composez le 15 (SAMU) ou le 112.",
    quoteTitle: "Une demande de transport ?",
    quoteBody:
      "Utilisez le formulaire de demande de devis : votre dossier sera créé dans votre espace et suivi par nos équipes.",
    quoteLink: "Aller à la demande de devis →",
  },
  en: {
    kicker: "Contact",
    title: "Let's talk about your need",
    intro:
      "A question, a partnership, a specific file? Write to us: your message is recorded and handled by our teams.",
    infoTitle: "Contact details",
    emailLabel: "Email",
    emailNote: "(placeholder)",
    hoursLabel: "Opening hours",
    hours: "Administrative team: Monday to Friday, 9am — 6pm",
    urgentLabel: "Emergencies",
    urgent:
      "This service is not a medical emergency service. In case of emergency, dial 15 (SAMU) or 112.",
    quoteTitle: "Need transport?",
    quoteBody:
      "Use the quote request form: your file will be created in your space and followed up by our teams.",
    quoteLink: "Go to the quote request →",
  },
} as const satisfies Record<Locale, Record<string, string>>;

export default async function ContactPage() {
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

      <section className="section-pad bg-white">
        <div className="container-x grid gap-10 lg:grid-cols-[1fr_1.2fr]">
          <div className="space-y-6">
            <div className="surface p-6">
              <h2 className="font-display text-lg font-semibold text-navy-900">{c.infoTitle}</h2>
              <dl className="mt-4 space-y-3 text-sm">
                <div>
                  <dt className="font-semibold text-navy-800">{c.emailLabel}</dt>
                  <dd className="text-navy-700/80">
                    contact@france-sante-transport.fr{" "}
                    <span className="text-navy-400">{c.emailNote}</span>
                  </dd>
                </div>
                <div>
                  <dt className="font-semibold text-navy-800">{c.hoursLabel}</dt>
                  <dd className="text-navy-700/80">{c.hours}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-navy-800">{c.urgentLabel}</dt>
                  <dd className="text-navy-700/80">{c.urgent}</dd>
                </div>
              </dl>
            </div>

            <div className="rounded-xl border border-navy-100 bg-navy-50 p-6">
              <h2 className="font-display text-lg font-semibold text-navy-900">{c.quoteTitle}</h2>
              <p className="mt-2 text-sm leading-relaxed text-navy-700/80">{c.quoteBody}</p>
              <a
                href="/devis"
                className="mt-4 inline-flex text-sm font-semibold text-navy-800 underline decoration-flagred-600 decoration-2 underline-offset-4"
              >
                {c.quoteLink}
              </a>
            </div>
          </div>

          <Suspense fallback={<div className="surface h-96 animate-pulse" />}>
            <ContactForm />
          </Suspense>
        </div>
      </section>
    </>
  );
}
