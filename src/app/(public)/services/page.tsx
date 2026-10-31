import type { Metadata } from "next";
import Link from "next/link";
import { getLabels } from "@/lib/labels";
import { getLocale } from "@/lib/i18n/server";
import type { Locale } from "@/lib/i18n/locale";
import type { ServiceType } from "@/lib/types";

export const metadata: Metadata = {
  title: "Services",
  description:
    "Transport médicalisé, fauteuil, brancard, transferts de rendez-vous et matériel médical : le détail des services France Santé Transport.",
};

type ServiceDetail = { audience: string; body: string; points: string[] };

const DETAILS = {
  fr: {
    medical_transport: {
      audience: "Patients, établissements, mutuelles et associations",
      body: "Prise en charge de bout en bout pour les trajets médicaux qui exigent un accompagnement attentif et une ponctualité irréprochable.",
      points: [
        "Chauffeurs formés à l'accueil des patients",
        "Créneau confirmé et suivi horodaté",
        "Interlocuteur unique pour les établissements",
      ],
    },
    wheelchair_transport: {
      audience: "Patients en fauteuil roulant",
      body: "Véhicules adaptés au maintien du fauteuil, avec assistance à la montée et à la descente.",
      points: [
        "Sangleage et maintien du fauteuil",
        "Véhicules équipés selon la mobilité",
        "Accompagnement porte à porte",
      ],
    },
    stretcher_transport: {
      audience: "Patients alités et transferts spécialisés",
      body: "Transport en brancard encadré, en coordination avec les équipes soignantes et les lieux de prise en charge.",
      points: [
        "Équipement de transport sécurisé",
        "Coordination avec l'établissement d'accueil",
        "Validation du dossier avant chaque mission",
      ],
    },
    appointment_transfer: {
      audience: "Patients à destination de rendez-vous médicaux",
      body: "Aller-retour organisé autour de votre rendez-vous : prise en charge à l'heure, attente gérée, retour à domicile.",
      points: [
        "Prise en charge calée sur le rendez-vous",
        "Gestion de l'attente sur place",
        "Traçabilité complète du trajet",
      ],
    },
    medical_supply: {
      audience: "Établissements, laboratoires, pharmacies",
      body: "Transport de matériel et de colis sensibles avec chaîne de responsabilité assurée jusqu'à la remise.",
      points: [
        "Remise contre accusé de réception",
        "Horodatage de chaque étape",
        "Suivi dédié aux volumes récurrents",
      ],
    },
    other: {
      audience: "Besoins spécifiques",
      body: "Un besoin hors cadre ? Décrivez-le dans votre demande : notre équipe évalue la faisabilité et revient vers vous avec une proposition.",
      points: [
        "Étude au cas par cas",
        "Réponse par un chargé d'affaires",
        "Proposition chiffrée par notre équipe",
      ],
    },
  } satisfies Record<ServiceType, ServiceDetail>,
  en: {
    medical_transport: {
      audience: "Patients, facilities, insurers and associations",
      body: "End-to-end handling for medical journeys that require careful assistance and impeccable punctuality.",
      points: [
        "Drivers trained in patient care",
        "Confirmed slot with timestamped tracking",
        "A single contact for facilities",
      ],
    },
    wheelchair_transport: {
      audience: "Wheelchair users",
      body: "Vehicles adapted to securing wheelchairs, with boarding and alighting assistance.",
      points: [
        "Wheelchair securing and restraint",
        "Vehicles equipped for mobility needs",
        "Door-to-door assistance",
      ],
    },
    stretcher_transport: {
      audience: "Bedridden patients and specialised transfers",
      body: "Supervised stretcher transport, coordinated with care teams and pickup locations.",
      points: [
        "Secure transport equipment",
        "Coordination with the receiving facility",
        "File validated before every mission",
      ],
    },
    appointment_transfer: {
      audience: "Patients travelling to medical appointments",
      body: "A round trip organised around your appointment: on-time pickup, waiting time managed, return home.",
      points: [
        "Pickup scheduled around the appointment",
        "Waiting time handled on site",
        "Full journey traceability",
      ],
    },
    medical_supply: {
      audience: "Facilities, laboratories, pharmacies",
      body: "Transport of equipment and sensitive parcels with an accountable chain of custody until handover.",
      points: [
        "Handover against signed receipt",
        "Every step timestamped",
        "Dedicated follow-up for recurring volumes",
      ],
    },
    other: {
      audience: "Specific needs",
      body: "Out-of-scope need? Describe it in your request: our team assesses feasibility and replies with a proposal.",
      points: [
        "Case-by-case assessment",
        "Answered by a coordinator",
        "A priced proposal from our team",
      ],
    },
  } satisfies Record<ServiceType, ServiceDetail>,
} as const satisfies Record<Locale, Record<ServiceType, ServiceDetail>>;

const COPY = {
  fr: {
    kicker: "Services",
    title: "Le bon véhicule, la bonne équipe, au bon moment",
    intro:
      "Six familles de prestations, un même standard : un dossier instruit, un prix validé par notre équipe, une mission confirmée avant tout engagement.",
    ctaTitle: "Un besoin de transport ?",
    ctaBody:
      "Décrivez votre trajet : notre équipe instruit la demande et vous adresse un devis versionné, avec un prix validé par nos soins.",
    ctaQuote: "Demander un devis",
    ctaContact: "Nous contacter",
  },
  en: {
    kicker: "Services",
    title: "The right vehicle, the right team, at the right time",
    intro:
      "Six service families, one standard: a file reviewed, a price validated by our team, a mission confirmed before any commitment.",
    ctaTitle: "Need transport?",
    ctaBody:
      "Describe your journey: our team reviews the request and sends you a versioned quote with a price validated by us.",
    ctaQuote: "Request a quote",
    ctaContact: "Contact us",
  },
} as const satisfies Record<Locale, Record<string, string>>;

export default async function ServicesPage() {
  const locale = await getLocale();
  const c = COPY[locale];
  const details = DETAILS[locale];
  const labels = getLabels(locale);

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
        <div className="container-x grid gap-6 lg:grid-cols-2">
          {(Object.keys(details) as ServiceType[]).map((key, index) => {
            const detail = details[key];
            return (
              <article key={key} className="surface flex flex-col p-8">
                <div className="flex items-baseline justify-between gap-4">
                  <span className="font-display text-sm font-bold text-flagred-600">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="rounded-full bg-navy-50 px-3 py-1 text-xs font-semibold text-navy-700">
                    {detail.audience}
                  </span>
                </div>
                <h2 className="mt-4 font-display text-2xl font-semibold text-navy-900">
                  {labels.service[key]}
                </h2>
                <p className="mt-3 leading-relaxed text-navy-700/80">{detail.body}</p>
                <ul className="mt-5 space-y-2.5">
                  {detail.points.map((point) => (
                    <li key={point} className="flex items-start gap-3 text-sm text-navy-800">
                      <span
                        aria-hidden="true"
                        className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-flagred-600"
                      />
                      {point}
                    </li>
                  ))}
                </ul>
              </article>
            );
          })}
        </div>

        <div className="container-x mt-12">
          <div className="rounded-2xl bg-navy-800 p-8 text-white sm:p-10">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-display text-2xl font-semibold">{c.ctaTitle}</h2>
                <p className="mt-2 max-w-xl text-sm leading-relaxed text-navy-100/85">{c.ctaBody}</p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/devis"
                  className="rounded-full bg-flagred-600 px-6 py-3 text-sm font-semibold hover:bg-flagred-500"
                >
                  {c.ctaQuote}
                </Link>
                <Link
                  href="/contact"
                  className="rounded-full border border-white/30 px-6 py-3 text-sm font-semibold hover:bg-white/10"
                >
                  {c.ctaContact}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
