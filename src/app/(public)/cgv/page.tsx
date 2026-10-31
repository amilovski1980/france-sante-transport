import type { Metadata } from "next";
import Link from "next/link";
import { getLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n/dictionaries";
import type { TKey } from "@/lib/i18n/dictionaries";

export const metadata: Metadata = {
  title: "CGV — Conditions générales de vente",
  description:
    "Conditions générales de vente de France Santé Transport : objet, commande, prix, paiement, annulation, responsabilité et litiges.",
};

export default async function CgvPage() {
  const locale = await getLocale();
  const t = (key: TKey) => translate(locale, key);

  return (
    <div className="container-x py-12">
      <article className="prose prose-navy mx-auto max-w-3xl">
        <h1 className="font-display text-3xl font-bold text-navy-900">
          Conditions générales de vente
        </h1>
        <p className="text-sm text-navy-500">
          Version applicable au {new Date().getFullYear()} — France Santé Transport.
        </p>

        <section className="mt-8 space-y-5 text-[0.95rem] leading-relaxed text-navy-800">
          <div>
            <h2 className="font-display text-lg font-semibold text-navy-900">1. Objet</h2>
            <p>
              Les présentes conditions régissent les prestations d'acheminement de produits
              biologiques, pharmaceutiques et médicaux sensibles réalisées par France Santé
              Transport (dénomination commerciale provisoire), à la demande de laboratoires,
              de pharmacies, d'établissements de santé ou de structures associées, sous forme de
              devis versionné préalablement validé. L'acheminement de personnes ne fait pas partie
              des prestations couvertes par le présent site.
            </p>
          </div>

          <div>
            <h2 className="font-display text-lg font-semibold text-navy-900">2. Commande et devis</h2>
            <p>
              Toute demande d'enlèvement est enregistrée, horodatée puis instruite par nos
              équipes. Un devis précisant le périmètre (type de produits, itinéraire, date,
              contrainte de température et conditionnement), le montant HT/TTC et les conditions
              particulières est transmis dans l'espace client. Seule la dernière version envoyée
              peut être acceptée par le client. La mission n'est engagée qu'après acceptation du
              devis par le client et confirmation manuelle par France Santé Transport.
            </p>
          </div>

          <div>
            <h2 className="font-display text-lg font-semibold text-navy-900">3. Prix</h2>
            <p>
              Les tarifs sont définis par devis (forfait ou kilométrage, suppléments de nuit,
              week-end, urgence ou matières à risque selon le cas). Les prix sont en euros, TTC
              à la TVA communiquée sur le devis. Toute modification en cours de mission fait
              l'objet d'un avenant.
            </p>
          </div>

          <div>
            <h2 className="font-display text-lg font-semibold text-navy-900">4. Paiement</h2>
            <p>
              Les factures sont émises après exécution de la mission et payables par carte
              bancaire sécurisée depuis l'espace client ou selon les conditions négociées pour
              les établissements. Toute somme impayée à l'échéance peut entraîner des frais de
              recouvrement.
            </p>
          </div>

          <div>
            <h2 className="font-display text-lg font-semibold text-navy-900">5. Annulation</h2>
            <p>
              L'annulation est gratuite jusqu'à la confirmation de la mission par nos équipes.
              Après confirmation, une mission annulée moins de 24 h avant le départ peut être
              facturée au tarif prévu. En cas d'indisponibilité de nos équipes, le client est
              informé sans délai et aucun montant n'est retenu.
            </p>
          </div>

          <div>
            <h2 className="font-display text-lg font-semibold text-navy-900">6. Responsabilité</h2>
            <p>
              France Santé Transport s'assure d'un acheminement encadré, traçable et adapté aux
              contraintes déclarées (température, conditionnement, normes applicables). Sa
              responsabilité suit la réglementation applicable au transport de produits de santé ;
              elle ne saurait être engagée en cas de force majeure ou d'information incomplète
              fournie par le client à la commande.
            </p>
          </div>

          <div>
            <h2 className="font-display text-lg font-semibold text-navy-900">7. Litiges</h2>
            <p>
              Toute contestation est traitée en priorité à l'amiable via la page contact. À
              défaut, le droit français s'applique et les tribunaux compétents de Paris le sont
              pour l'ensemble des litiges.
            </p>
          </div>
        </section>

        <p className="mt-10 text-sm">
          <Link href="/contact" className="font-semibold text-flagred-600 hover:underline">
            {t("footer.link.contact")} →
          </Link>
        </p>
      </article>
    </div>
  );
}
