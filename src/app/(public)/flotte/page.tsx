import type { Metadata } from "next";
import Link from "next/link";
import { getLocale } from "@/lib/i18n/server";
import type { Locale } from "@/lib/i18n/locale";

export const metadata: Metadata = {
  title: "Flotte",
  description:
    "Une flotte diversifiée et entretenue : fourgons frigorifiques, véhicules isothermes pour carboglace, vans d'enlèvement et véhicules de messagerie médicale.",
};

const FLEET = {
  fr: [
    {
      type: "Fourgon frigorifique",
      usage: "Distribution pharmaceutique et produits soumis aux Bonnes Pratiques (BPD).",
      specs: ["Température régulée 2–8 °C", "Emplacements scellés", "Traçabilité de température"],
      lift: true,
    },
    {
      type: "Véhicule isotherme carboglace",
      usage: "Envois à très basse température (-78,5 °C) pour biotechnologies.",
      specs: ["Caisse isotherme certifiée", "Équipement carboglace", "Permis ATD vérifié"],
      lift: true,
    },
    {
      type: "Van d'enlèvement",
      usage: "Collectes planifiées 24/7 auprès des laboratoires et structures de santé.",
      specs: ["Chargement arrière élargi", "Touring urbain rapide", "Chauffeur dédié"],
      lift: false,
    },
    {
      type: "Véhicule UN 3373",
      usage: "Prélèvements et échantillons biologiques sous chaîne du froid.",
      specs: ["Conteneurs validés", "Horodatage des étapes", "Remise contre accusé"],
      lift: false,
    },
    {
      type: "Véhicule messagerie santé",
      usage: "Matériel et colis médicaux sensibles avec chaîne de responsabilité.",
      specs: ["Remise responsable", "Suivi de tournée", "Volumes récurrents gérés"],
      lift: false,
    },
  ],
  en: [
    {
      type: "Refrigerated van",
      usage: "Pharmaceutical distribution and products under Good Distribution Practices (GDP).",
      specs: ["Regulated 2–8 °C temperature", "Sealed slots", "Temperature traceability"],
      lift: true,
    },
    {
      type: "Dry ice insulated vehicle",
      usage: "Very-low-temperature shipments (-78.5 °C) for biotech.",
      specs: ["Certified insulated box", "Dry-ice equipment", "TDG clearance checked"],
      lift: true,
    },
    {
      type: "Pickup van",
      usage: "24/7 scheduled collections from laboratories and health facilities.",
      specs: ["Wide rear loading", "Fast urban routing", "Dedicated driver"],
      lift: false,
    },
    {
      type: "UN 3373 vehicle",
      usage: "Biological samples and specimens under cold chain.",
      specs: ["Validated containers", "Timestamped steps", "Handover with receipt"],
      lift: false,
    },
    {
      type: "Health courier vehicle",
      usage: "Sensitive medical equipment and parcels with accountable custody.",
      specs: ["Responsible handover", "Route tracking", "Recurring volumes managed"],
      lift: false,
    },
  ],
} as const satisfies Record<Locale, readonly { type: string; usage: string; specs: readonly string[]; lift: boolean }[]>;

const COPY = {
  fr: {
    kicker: "Flotte",
    title: "Des véhicules choisis pour la chaîne du froid et la conformité",
    intro:
      "Chaque mission est préparée avec le véhicule adapté à la nature des produits et à la température requise, après confirmation de nos équipes.",
    equipped: "Équipé",
    fleetTitle: "Composition de la flotte",
    fleetBody:
      "L'inventaire réel est géré par nos équipes et ajusté en continu. La disponibilité d'un véhicule est confirmée lors de la validation de votre mission.",
    bookCta: "Réserver un véhicule",
  },
  en: {
    kicker: "Fleet",
    title: "Vehicles chosen for cold chain and compliance",
    intro:
      "Every mission is prepared with the vehicle suited to the products and the required temperature, after confirmation by our teams.",
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
