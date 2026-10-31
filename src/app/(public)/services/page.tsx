import type { Metadata } from "next";
import Link from "next/link";
import { getLabels } from "@/lib/labels";
import { getLocale } from "@/lib/i18n/server";
import type { Locale } from "@/lib/i18n/locale";
import type { ServiceType } from "@/lib/types";

export const metadata: Metadata = {
  title: "Services",
  description:
    "Logistique de santé : transport biologique (UN 3373), distribution pharmaceutique (BPD), acheminements sous carboglace -78,5 °C et enlèvements planifiés 24/7.",
};

type ServiceDetail = { audience: string; body: string; points: string[] };

const DETAILS = {
  fr: {
    medical_transport: {
      audience: "Laboratoires, hôpitaux, structures de recherche",
      body: "Nous acheminons vos prélèvements et échantillons biologiques en garantissant le strict respect de la chaîne du froid et des normes UN 3373.",
      points: [
        "Chaîne du froid respectée de bout en bout",
        "Conformité aux normes UN 3373 (matières biologiques)",
        "Traçabilité horodatée jusqu'à la remise au laboratoire",
      ],
    },
    wheelchair_transport: {
      audience: "Pharmacies, grossistes, établissements de santé",
      body: "Nous veillons à la distribution sécurisée de vos médicaments et produits de santé en conformité avec les Bonnes Pratiques de Distribution (BPD).",
      points: [
        "Conformité aux Bonnes Pratiques de Distribution (BPD)",
        "Emballages scellés et remise responsable",
        "Suivi dédié aux volumes récurrents",
      ],
    },
    stretcher_transport: {
      audience: "Industrie pharmaceutique, biotechnologies",
      body: "Nous sécurisons vos transports à très basse température (-78,5 °C) grâce à l'utilisation de carboglace pour maintenir l'intégrité de vos produits les plus critiques.",
      points: [
        "Maintien à -78,5 °C grâce à la carboglace",
        "Emballages isothermes homologués",
        "Traçabilité de température sur toute la mission",
      ],
    },
    appointment_transfer: {
      audience: "Laboratoires, professionnels de santé, entreprises",
      body: "Planifiez vos demandes d'enlèvement en ligne 24/7 pour une prise en charge rapide, ponctuelle ou régulière, adaptée à vos urgences.",
      points: [
        "Commande d'enlèvement en ligne 24/7",
        "Tours réguliers ou prises en charge ponctuelles",
        "Ajustement possible en cas d'urgence",
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
      audience: "Laboratories, hospitals, research facilities",
      body: "We ship your biological samples while strictly maintaining the cold chain and UN 3373 requirements.",
      points: [
        "Cold chain preserved end to end",
        "Compliance with UN 3373 (biological substances)",
        "Timestamped traceability up to lab handover",
      ],
    },
    wheelchair_transport: {
      audience: "Pharmacies, wholesalers, care facilities",
      body: "We ensure the secure distribution of your medicines and health products in line with Good Distribution Practices (GDP).",
      points: [
        "Compliance with Good Distribution Practices (GDP)",
        "Sealed packaging and responsible handover",
        "Dedicated follow-up for recurring volumes",
      ],
    },
    stretcher_transport: {
      audience: "Pharmaceutical industry, biotech",
      body: "We secure your very-low-temperature shipments (-78.5 °C) using dry ice to maintain the integrity of your most critical products.",
      points: [
        "-78.5 °C maintained with dry ice",
        "Certified insulated packaging",
        "Temperature traceability along the mission",
      ],
    },
    appointment_transfer: {
      audience: "Laboratories, healthcare professionals, companies",
      body: "Schedule your pickup requests online 24/7 for fast, punctual or regular handling, matched to your emergencies.",
      points: [
        "Online pickup booking 24/7",
        "Regular routes or one-off collections",
        "Adjustable in case of emergency",
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
    kicker: "Nos services",
    title: "La logistique de santé pensée pour vos produits sensibles",
    intro:
      "Notre expertise en logistique de santé et notre connaissance des réseaux médicaux vous assurent un transport rapide, fiable et sécurisé de vos produits biologiques et médicaux sensibles.",
    ctaTitle: "Un produit à acheminer ?",
    ctaBody:
      "Décrivez votre envoi : notre équipe instruit la demande et vous adresse un devis versionné, avec un prix validé par nos soins.",
    ctaQuote: "Demander un devis",
    ctaContact: "Nous contacter",
  },
  en: {
    kicker: "Our services",
    title: "Logistics designed for your sensitive products",
    intro:
      "Our expertise in healthcare logistics and our knowledge of medical networks ensure fast, reliable and secure transport of your sensitive biological and medical products.",
    ctaTitle: "A product to ship?",
    ctaBody:
      "Describe your shipment: our team reviews the request and sends you a versioned quote with a price validated by us.",
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
