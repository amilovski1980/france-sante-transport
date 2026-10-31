import type { Metadata } from "next";
import Link from "next/link";
import { getLocale } from "@/lib/i18n/server";
import type { Locale } from "@/lib/i18n/locale";

export const metadata: Metadata = {
  title: "Apport d'affaires",
  description:
    "Devenez partenaire France Santé Transport : présentations d'établissements, de cabinets et de structures médicales.",
};

const CONTENT = {
  fr: {
    kicker: "Apport d'affaires",
    title: "Faites avancer la santé avec nous",
    intro:
      "Vous exploitez un laboratoire, une pharmacie, une structure de santé ou un réseau biomédical ? Devenez partenaire de France Santé Transport et proposez à vos écosystèmes une logistique des produits de santé rapide, fiable et sécurisée.",
    heroCta: "Proposer un partenariat",
    partners: [
      {
        title: "Laboratoires et centres de biologie",
        body: "Laboratoires d'analyses, centres de biologie et structures de recherche qui acheminent quotidiennement des prélèvements et échantillons soumis à la chaîne du froid.",
      },
      {
        title: "Pharmacies et distributeurs",
        body: "Officines, grossistes et plateformes de distribution recherchant un acheminement sûr de leurs médicaments et produits de santé, conformes aux BPD.",
      },
      {
        title: "Établissements de santé",
        body: "Hôpitaux, cliniques et institutions qui envoient du matériel médical, des produits sanguins ou des échantillons entre leurs services.",
      },
    ],
    howKicker: "Comment ça marche",
    howTitle: "Trois étapes, un cadre clair",
    howBody:
      "Les modalités financières éventuelles sont définies par nos équipes et formalisées par contrat : aucun montant n'est annoncé avant validation interne.",
    steps: [
      {
        n: "01",
        title: "Vous nous présentez un besoin",
        body: "Établissement, cabinet ou structure : vous nous transmettez le contact via le formulaire dédié.",
      },
      {
        n: "02",
        title: "Nous qualifions le partenariat",
        body: "Notre équipe échange avec vous, définit le cadre de collaboration et les conditions applicables.",
      },
      {
        n: "03",
        title: "La collaboration est formalisée",
        body: "Les modalités de retour, définies et validées par nos équipes, sont contractualisées par écrit.",
      },
    ],
    partnerCta: "Devenir partenaire",
    questionCta: "Poser une question",
  },
  en: {
    kicker: "Business referral",
    title: "Advance health with us",
    intro:
      "You run a laboratory, a pharmacy, a health facility or a biomedical network? Become a partner of France Santé Transport and offer your ecosystem fast, reliable and secure health-product logistics.",
    heroCta: "Propose a partnership",
    partners: [
      {
        title: "Laboratories and biology centres",
        body: "Testing laboratories, biology centres and research structures shipping samples subject to the cold chain every day.",
      },
      {
        title: "Pharmacies and distributors",
        body: "Pharmacies, wholesalers and distribution platforms looking for safe, GDP-compliant shipping of their medicines and health products.",
      },
      {
        title: "Healthcare facilities",
        body: "Hospitals, clinics and institutions sending medical equipment, blood products or samples between their services.",
      },
    ],
    howKicker: "How it works",
    howTitle: "Three steps, a clear framework",
    howBody:
      "Any financial terms are defined by our teams and formalised by contract: no amount is announced before internal validation.",
    steps: [
      {
        n: "01",
        title: "You introduce a need",
        body: "Facility, practice or structure: you send us the contact through the dedicated form.",
      },
      {
        n: "02",
        title: "We qualify the partnership",
        body: "Our team discusses with you, defines the collaboration framework and applicable conditions.",
      },
      {
        n: "03",
        title: "The collaboration is formalised",
        body: "The referral terms, defined and validated by our teams, are contractually agreed in writing.",
      },
    ],
    partnerCta: "Become a partner",
    questionCta: "Ask a question",
  },
} as const satisfies Record<Locale, Record<string, string | readonly { n: string; title: string; body: string }[] | readonly { title: string; body: string }[]>>;

export default async function ReferralPage() {
  const locale = await getLocale();
  const c = CONTENT[locale];

  return (
    <>
      <section className="relative overflow-hidden bg-navy-900 py-20 text-white">
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[radial-gradient(ellipse_at_left,rgba(193,39,45,0.25),transparent_55%)]"
        />
        <div className="container-x relative max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-flagred-500">{c.kicker}</p>
          <h1 className="mt-3 font-display text-4xl font-semibold sm:text-5xl">{c.title}</h1>
          <p className="mt-5 text-lg leading-relaxed text-navy-100/90">{c.intro}</p>
          <div className="mt-8">
            <Link
              href="/contact?topic=referral"
              className="rounded-full bg-flagred-600 px-7 py-3.5 text-sm font-semibold hover:bg-flagred-500"
            >
              {c.heroCta}
            </Link>
          </div>
        </div>
      </section>

      <section className="section-pad bg-white">
        <div className="container-x grid gap-8 lg:grid-cols-3">
          {c.partners.map((partner) => (
            <div key={partner.title} className="surface p-7">
              <span aria-hidden="true" className="block h-1 w-12 rounded-full bg-flagred-600" />
              <h2 className="mt-5 font-display text-xl font-semibold text-navy-900">{partner.title}</h2>
              <p className="mt-3 text-sm leading-relaxed text-navy-700/80">{partner.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="section-pad bg-navy-50">
        <div className="container-x">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-flagred-600">{c.howKicker}</p>
            <h2 className="mt-3 font-display text-3xl font-semibold text-navy-900 sm:text-4xl">{c.howTitle}</h2>
            <p className="mt-4 text-navy-700/80 leading-relaxed">{c.howBody}</p>
          </div>

          <ol className="mt-12 grid gap-6 md:grid-cols-3">
            {c.steps.map((step) => (
              <li key={step.n} className="surface p-7">
                <span className="font-display text-3xl font-bold text-navy-200">{step.n}</span>
                <h3 className="mt-4 font-semibold text-navy-900">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-navy-700/75">{step.body}</p>
              </li>
            ))}
          </ol>

          <div className="mt-10 flex flex-wrap gap-3">
            <Link
              href="/contact?topic=referral"
              className="rounded-full bg-navy-800 px-6 py-3 text-sm font-semibold text-white hover:bg-navy-700"
            >
              {c.partnerCta}
            </Link>
            <Link
              href="/contact"
              className="rounded-full border border-navy-200 px-6 py-3 text-sm font-semibold text-navy-800 hover:bg-white"
            >
              {c.questionCta}
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
