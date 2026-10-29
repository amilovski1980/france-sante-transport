import type { Metadata } from "next";
import Link from "next/link";
import { getLocale } from "@/lib/i18n/server";
import type { Locale } from "@/lib/i18n/locale";

export const metadata: Metadata = {
  title: "Flotte",
  description:
    "Une flotte diversifiée et entretenue : berlines, vans, minibus, véhicules équipés pour le brancard et l'ambulance.",
};

const FLEET = {
  fr: [
    {
      type: "Berline",
      usage: "Transport de patients en état de marche ou avec assistance minimale.",
      specs: ["Confort et discrétion", "Idéal trajets rendez-vous", "Poste avant libre pour accompagnant"],
      lift: false,
    },
    {
      type: "Van",
      usage: "Fauteuils roulants et petits groupes, montée facilitée.",
      specs: ["Accès élargi", "Sangleage fauteuil", "Capacité modulable"],
      lift: true,
    },
    {
      type: "Minibus",
      usage: "Transferts de groupes : établissements, structures, événements de santé.",
      specs: ["Capacité élevée", "Circuits planifiés", "Chauffeur dédié"],
      lift: false,
    },
    {
      type: "Véhicule brancard",
      usage: "Patients alités, transferts entre structures de soins.",
      specs: ["Brancard sécurisé", "Équipement médical de bord", "Équipes formées"],
      lift: true,
    },
    {
      type: "Ambulance",
      usage: "Médicalisation renforcée selon les besoins du dossier.",
      specs: ["Configuration sanitaire", "Matériel de surveillance", "Déploiement sur validation"],
      lift: true,
    },
  ],
  en: [
    {
      type: "Sedan",
      usage: "Transport of ambulatory patients or with minimal assistance.",
      specs: ["Comfort and discretion", "Ideal for appointment trips", "Free front seat for companion"],
      lift: false,
    },
    {
      type: "Van",
      usage: "Wheelchairs and small groups, easy boarding.",
      specs: ["Wide access", "Wheelchair restraint", "Modular capacity"],
      lift: true,
    },
    {
      type: "Minibus",
      usage: "Group transfers: facilities, structures, health events.",
      specs: ["High capacity", "Planned routes", "Dedicated driver"],
      lift: false,
    },
    {
      type: "Stretcher vehicle",
      usage: "Bedridden patients, transfers between care facilities.",
      specs: ["Secure stretcher", "Onboard medical equipment", "Trained teams"],
      lift: true,
    },
    {
      type: "Ambulance",
      usage: "Enhanced medicalization according to the file's needs.",
      specs: ["Medical configuration", "Monitoring equipment", "Deployment on validation"],
      lift: true,
    },
  ],
} as const satisfies Record<Locale, readonly { type: string; usage: string; specs: readonly string[]; lift: boolean }[]>;

const COPY = {
  fr: {
    kicker: "Flotte",
    title: "Des véhicules choisis pour le service médical",
    intro:
      "Chaque mission est préparée avec le véhicule adapté au profil du patient et à la nature du transport, après confirmation de nos équipes.",
    equipped: "Équipé",
    fleetTitle: "Composition de la flotte",
    fleetBody:
      "L'inventaire réel est géré par nos équipes et ajusté en continu. La disponibilité d'un véhicule est confirmée lors de la validation de votre mission.",
    bookCta: "Réserver un véhicule",
  },
  en: {
    kicker: "Fleet",
    title: "Vehicles chosen for medical service",
    intro:
      "Every mission is prepared with the vehicle suited to the patient's profile and the nature of the transport, after confirmation by our teams.",
    equipped: "Equipped",
    fleetTitle: "Fleet composition",
    fleetBody:
      "The real inventory is managed by our teams and continuously adjusted. Vehicle availability is confirmed when your mission is validated.",
    bookCta: "Book a vehicle",
  },
} as const satisfies Record<Locale, Record<string, string>>;

export default async function FlottePage() {
  const locale = await getLocale();
  const c = COPY[locale];
  const fleet = FLEET[locale];

  return (
    <>
      <section className="bg-navy-900 py-20 text-white">
        <div className="container-x max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-flagred-500">{c.kicker}</p>
          <h1 className="mt-3 font-display text-4xl font-semibold sm:text-5xl">{c.title}</h1>
          <p className="mt-5 text-lg leading-relaxed text-navy-100/90">{c.intro}</p>
        </div>
      </section>

      <section className="section-pad bg-white">
        <div className="container-x">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {fleet.map((vehicle) => (
              <article key={vehicle.type} className="surface flex flex-col p-7">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="font-display text-xl font-semibold text-navy-900">{vehicle.type}</h2>
                  {vehicle.lift && (
                    <span className="rounded-full border border-flagred-600/30 bg-flagred-50 px-2.5 py-0.5 text-xs font-semibold text-flagred-700">
                      {c.equipped}
                    </span>
                  )}
                </div>
                <p className="mt-3 text-sm leading-relaxed text-navy-700/80">{vehicle.usage}</p>
                <ul className="mt-5 space-y-2 border-t border-navy-100 pt-5 text-sm text-navy-800">
                  {vehicle.specs.map((spec) => (
                    <li key={spec} className="flex items-start gap-2.5">
                      <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 rounded-full bg-navy-400" />
                      {spec}
                    </li>
                  ))}
                </ul>
              </article>
            ))}

            <article className="flex flex-col justify-between rounded-2xl bg-navy-50 p-7">
              <div>
                <h2 className="font-display text-xl font-semibold text-navy-900">{c.fleetTitle}</h2>
                <p className="mt-3 text-sm leading-relaxed text-navy-700/80">{c.fleetBody}</p>
              </div>
              <Link
                href="/devis"
                className="mt-6 inline-flex rounded-full bg-navy-800 px-6 py-3 text-center text-sm font-semibold text-white hover:bg-navy-700"
              >
                {c.bookCta}
              </Link>
            </article>
          </div>
        </div>
      </section>
    </>
  );
}
