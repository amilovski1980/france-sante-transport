import Link from "next/link";
import { getLabels } from "@/lib/labels";
import { getLocale } from "@/lib/i18n/server";
import type { Locale } from "@/lib/i18n/locale";

const COPY = {
  fr: {
    badge: "Transport sanitaire · France",
    titleLine1: "Le transport qui fait",
    titleLine2: "avancer la santé",
    heroText:
      "Patients, établissements et professionnels de santé : un transport encadré, traçable et piloté par des équipes dédiées, de la demande de devis jusqu'à la clôture de la mission.",
    ctaQuote: "Demander un devis",
    ctaServices: "Découvrir nos services",
    journeyCardTitle: "Un parcours sous contrôle",
    ctaSpace: "Créer mon espace client",
    servicesKicker: "Nos services",
    servicesTitle: "Des prestations pensées pour le secteur médical",
    servicesIntro:
      "Chaque type de transport répond à un besoin précis, avec le niveau d'accompagnement et de sécurité adapté.",
    serviceCardBody:
      "Prise en charge organisée, interlocuteur identifié et suivi horodaté jusqu'à l'arrivée.",
    servicesLink: "Voir le détail des services →",
    journeyKicker: "Parcours client",
    journeyTitle: "De la demande à la mission, rien n'est laissé au hasard",
    commitmentsKicker: "Nos engagements",
    commitmentsTitle: "Une exigence de service digne du secteur de la santé",
    ctaStart: "Démarrer une demande",
    ctaTalk: "Parler à une équipe",
    steps: [
      {
        n: "01",
        title: "Vous soumettez votre demande",
        body: "En quelques minutes, depuis votre espace : trajet, créneau, besoins du patient. La demande est enregistrée et horodatée.",
      },
      {
        n: "02",
        title: "Notre équipe instruit le dossier",
        body: "Un chargé d'affaires examine la demande et vous adresse un devis versionné, avec un prix validé par l'équipe.",
      },
      {
        n: "03",
        title: "Vous acceptez, la mission est créée",
        body: "Vous acceptez la version qui vous a été envoyée. La mission reste en attente de confirmation interne avant tout engagement.",
      },
      {
        n: "04",
        title: "La mission est confirmée et suivie",
        body: "Après validation de nos équipes, chauffeur et véhicule sont affectés. Chaque événement est journalisé et horodaté.",
      },
    ],
    commitments: [
      {
        title: "Traçabilité de bout en bout",
        body: "Chaque demande, chaque devis, chaque événement de mission est horodaté dans un journal consultable par les parties autorisées.",
      },
      {
        title: "Prix définis par notre équipe",
        body: "Aucun tarif n'est auto-généré : chaque devis est préparé, vérifié puis envoyé par un membre autorisé de nos équipes.",
      },
      {
        title: "Données de santé protégées",
        body: "Accès strictement encadrés par rôle : un client ne voit que ses propres dossiers, les équipes voient ce qui leur est nécessaire.",
      },
      {
        title: "Confirmation humaine",
        body: "Une mission n'est jamais confirmée automatiquement : elle exige une validation explicite avant d'être engagée.",
      },
    ],
  },
  en: {
    badge: "Medical transport · France",
    titleLine1: "Transport that keeps",
    titleLine2: "health moving",
    heroText:
      "Patients, care facilities and healthcare professionals: supervised, fully traceable transport run by dedicated teams, from the quote request to mission closure.",
    ctaQuote: "Request a quote",
    ctaServices: "Discover our services",
    journeyCardTitle: "A journey under control",
    ctaSpace: "Create my client space",
    servicesKicker: "Our services",
    servicesTitle: "Services designed for the healthcare sector",
    servicesIntro:
      "Each transport type answers a specific need, with the right level of assistance and safety.",
    serviceCardBody:
      "Organised pickup, a named contact and timestamped follow-through until arrival.",
    servicesLink: "See the service details →",
    journeyKicker: "Client journey",
    journeyTitle: "From request to mission, nothing is left to chance",
    commitmentsKicker: "Our commitments",
    commitmentsTitle: "A level of service worthy of healthcare",
    ctaStart: "Start a request",
    ctaTalk: "Talk to our team",
    steps: [
      {
        n: "01",
        title: "You submit your request",
        body: "In a few minutes, from your space: route, time slot, patient needs. The request is recorded and timestamped.",
      },
      {
        n: "02",
        title: "Our team reviews the file",
        body: "A coordinator examines the request and sends you a versioned quote with a price validated by the team.",
      },
      {
        n: "03",
        title: "You accept, the mission is created",
        body: "You accept the version that was sent to you. The mission then awaits internal confirmation before any commitment.",
      },
      {
        n: "04",
        title: "The mission is confirmed and tracked",
        body: "Once validated by our teams, a driver and vehicle are assigned. Every event is logged and timestamped.",
      },
    ],
    commitments: [
      {
        title: "End-to-end traceability",
        body: "Every request, every quote, every mission event is timestamped in a log accessible to authorised parties.",
      },
      {
        title: "Prices set by our team",
        body: "No rate is auto-generated: each quote is prepared, reviewed and sent by an authorised member of our teams.",
      },
      {
        title: "Protected health data",
        body: "Access strictly scoped by role: a client only sees their own files, teams see what they need.",
      },
      {
        title: "Human confirmation",
        body: "A mission is never confirmed automatically: it requires explicit validation before being committed.",
      },
    ],
  },
} as const satisfies Record<Locale, Record<string, unknown>>;

export default async function HomePage() {
  const locale = await getLocale();
  const c = COPY[locale];
  const labels = getLabels(locale);

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-navy-900 text-white">
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(30,75,147,0.55),transparent_55%)]"
        />
        <div
          aria-hidden="true"
          className="absolute bottom-0 left-0 h-1 w-2/3 bg-gradient-to-r from-flagred-600 via-white to-navy-500 opacity-80"
        />
        <div className="container-x relative grid gap-12 py-24 lg:grid-cols-[1.15fr_0.85fr] lg:py-32">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-navy-100">
              {c.badge}
            </p>
            <h1 className="mt-6 font-display text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">
              {c.titleLine1}
              <span className="block text-flagred-500">{c.titleLine2}</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-navy-100/90">{c.heroText}</p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link
                href="/devis"
                className="rounded-full bg-flagred-600 px-7 py-3.5 text-sm font-semibold shadow-lg shadow-flagred-900/30 transition-colors hover:bg-flagred-500"
              >
                {c.ctaQuote}
              </Link>
              <Link
                href="/services"
                className="rounded-full border border-white/25 px-7 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-white/10"
              >
                {c.ctaServices}
              </Link>
            </div>
          </div>

          <div className="rounded-2xl border border-white/15 bg-white/5 p-7 backdrop-blur-sm">
            <p className="font-display text-xl font-semibold text-white">{c.journeyCardTitle}</p>
            <ul className="mt-6 space-y-5">
              {c.steps.slice(0, 3).map((step) => (
                <li key={step.n} className="flex gap-4">
                  <span className="font-display text-lg font-bold text-flagred-500">{step.n}</span>
                  <span>
                    <span className="block text-sm font-semibold text-white">{step.title}</span>
                    <span className="mt-1 block text-sm leading-relaxed text-navy-100/80">
                      {step.body}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
            <Link
              href="/signup"
              className="mt-7 inline-flex text-sm font-semibold text-white underline decoration-flagred-500 decoration-2 underline-offset-4 hover:decoration-white"
            >
              {c.ctaSpace}
            </Link>
          </div>
        </div>
      </section>

      {/* Services */}
      <section className="section-pad bg-white">
        <div className="container-x">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-flagred-600">
              {c.servicesKicker}
            </p>
            <h2 className="mt-3 font-display text-3xl font-semibold text-navy-900 sm:text-4xl">
              {c.servicesTitle}
            </h2>
            <p className="mt-4 text-navy-700/80 leading-relaxed">{c.servicesIntro}</p>
          </div>

          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {(Object.keys(labels.service) as (keyof typeof labels.service)[]).map((key) => (
              <div
                key={key}
                className="surface group p-6 transition-all duration-300 hover:-translate-y-1 hover:border-navy-200"
              >
                <span className="block h-1 w-10 rounded-full bg-flagred-600 transition-all duration-300 group-hover:w-16" />
                <h3 className="mt-5 font-display text-lg font-semibold text-navy-900">
                  {labels.service[key]}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-navy-700/75">{c.serviceCardBody}</p>
              </div>
            ))}
          </div>

          <div className="mt-10">
            <Link
              href="/services"
              className="text-sm font-semibold text-navy-800 underline decoration-flagred-600 decoration-2 underline-offset-4"
            >
              {c.servicesLink}
            </Link>
          </div>
        </div>
      </section>

      {/* Parcours */}
      <section className="section-pad bg-navy-50">
        <div className="container-x">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-flagred-600">
              {c.journeyKicker}
            </p>
            <h2 className="mt-3 font-display text-3xl font-semibold text-navy-900 sm:text-4xl">
              {c.journeyTitle}
            </h2>
          </div>
          <ol className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {c.steps.map((step) => (
              <li key={step.n} className="surface p-6">
                <span className="font-display text-3xl font-bold text-navy-200">{step.n}</span>
                <h3 className="mt-4 font-semibold text-navy-900">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-navy-700/75">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Engagements */}
      <section className="section-pad bg-white">
        <div className="container-x grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-flagred-600">
              {c.commitmentsKicker}
            </p>
            <h2 className="mt-3 font-display text-3xl font-semibold text-navy-900 sm:text-4xl">
              {c.commitmentsTitle}
            </h2>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/devis"
                className="rounded-full bg-navy-800 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-navy-700"
              >
                {c.ctaStart}
              </Link>
              <Link
                href="/contact"
                className="rounded-full border border-navy-200 px-6 py-3 text-sm font-semibold text-navy-800 transition-colors hover:bg-navy-50"
              >
                {c.ctaTalk}
              </Link>
            </div>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            {c.commitments.map((item) => (
              <div key={item.title} className="rounded-xl border border-navy-100 bg-navy-50/60 p-6">
                <h3 className="font-semibold text-navy-900">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-navy-700/80">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
