import type { Metadata } from "next";
import Link from "next/link";
import { getLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n/dictionaries";
import type { TKey } from "@/lib/i18n/dictionaries";

export const metadata: Metadata = {
  title: "Conditions d'utilisation du site",
  description:
    "Conditions d'utilisation du site France Santé Transport : espace client, données personnelles, comptes et conduite attendue des utilisateurs.",
};

export default async function ConditionsPage() {
  const locale = await getLocale();
  const t = (key: TKey) => translate(locale, key);

  return (
    <div className="container-x py-12">
      <article className="prose prose-navy mx-auto max-w-3xl">
        <h1 className="font-display text-3xl font-bold text-navy-900">
          Conditions d'utilisation du site
        </h1>
        <p className="text-sm text-navy-500">
          Version applicable au {new Date().getFullYear()} — France Santé Transport.
        </p>

        <section className="mt-8 space-y-5 text-[0.95rem] leading-relaxed text-navy-800">
          <div>
            <h2 className="font-display text-lg font-semibold text-navy-900">1. Acceptation</h2>
            <p>
              L'utilisation du site (consultation, demande de devis, création d'un espace client,
              participation à l'apport d'affaires, inscription santé mail) implique l'acceptation
              sans réserve des présentes conditions d'utilisation.
            </p>
          </div>

          <div>
            <h2 className="font-display text-lg font-semibold text-navy-900">2. Espace client</h2>
            <p>
              Les identifiants d'accès (e-mail, mot de passe) sont personnels et confidentiels.
              Toute action réalisée depuis l'espace client est réputée effectuée par son titulaire.
              En cas de suspicion d'usurpation, contactez-nous immédiatement depuis la page
              contact.
            </p>
          </div>

          <div>
            <h2 className="font-display text-lg font-semibold text-navy-900">3. Données transmises</h2>
            <p>
              Les informations communiquées (coordonnées, itinéraire, nature des produits,
              contraintes de température)
              ne servent qu'à organiser la prestation demandée. Elles sont limitées aux personnes
              habilitées au sein de nos équipes et ne sont ni revendues ni utilisées à d'autres
              fins que la gestion de votre dossier.
            </p>
          </div>

          <div>
            <h2 className="font-display text-lg font-semibold text-navy-900">4. Assistante Aminia</h2>
            <p>
              L'assistante conversationnelle Aminia fournit une orientation automatisée vers les
              services adaptés. Ses réponses sont indicatives et ne constituent ni un devis ni un
              engagement contractuel ; seul un devis versionné validé dans l'espace client a
              valeur contractuelle.
            </p>
          </div>

          <div>
            <h2 className="font-display text-lg font-semibold text-navy-900">5. Newsletter</h2>
            <p>
              L'inscription se fait librement depuis le lien de diffusion disponible sur ce
              site. Le désabonnement est possible à tout moment via le lien présent dans
              chaque envoi.
            </p>
          </div>

          <div>
            <h2 className="font-display text-lg font-semibold text-navy-900">6. Utilisation du site</h2>
            <p>
              Il est interdit d'utiliser le site de manière frauduleuse, de porter atteinte à sa
              disponibilité ou d'extraire massivement son contenu. Les éléments constitutifs du
              site (textes, visuels, logos, interface) appartiennent à France Santé Transport.
            </p>
          </div>

          <div>
            <h2 className="font-display text-lg font-semibold text-navy-900">7. Évolutions</h2>
            <p>
              Ces conditions peuvent évoluer pour refléter l'avancement du service. La version en
              vigueur est celle publiée sur cette page à la date de vos visites et usages.
            </p>
          </div>
        </section>

        <p className="mt-10 text-sm">
          <Link href="/cgv" className="font-semibold text-flagred-600 hover:underline">
            {t("footer.link.cgv")} →
          </Link>
        </p>
      </article>
    </div>
  );
}
