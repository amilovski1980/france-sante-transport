import Link from "next/link";
import type { BrandingSettings } from "@/lib/branding";
import { DEFAULT_BRANDING } from "@/lib/branding";
import { getLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n/dictionaries";
import type { TKey } from "@/lib/i18n/dictionaries";

export default async function Footer({ branding }: { branding?: BrandingSettings }) {
  const locale = await getLocale();
  const t = (key: TKey) => translate(locale, key);
  const slogan = branding?.slogan || DEFAULT_BRANDING.slogan;
  return (
    <footer className="border-t border-navy-800/10 bg-navy-900 text-navy-100">
      <div className="container-x grid gap-10 py-14 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <p className="font-display text-lg font-semibold tracking-wide text-white">
            FRANCE SANTÉ <span className="text-flagred-500">TRANSPORT</span>
          </p>
          <p className="mt-3 max-w-xs text-sm italic leading-relaxed text-navy-200">
            « {slogan} »
          </p>
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-navy-200/80">
            {t("footer.description")}
          </p>
        </div>

        <nav aria-label={t("footer.navigation")}>
          <p className="text-xs font-semibold uppercase tracking-widest text-white/70">{t("footer.navigation")}</p>
          <ul className="mt-4 space-y-2.5 text-sm">
            <li><Link href="/" className="hover:text-white">{t("footer.link.home")}</Link></li>
            <li><Link href="/services" className="hover:text-white">{t("footer.link.services")}</Link></li>
            <li><Link href="/flotte" className="hover:text-white">{t("footer.link.fleet")}</Link></li>
          </ul>
        </nav>

        <nav aria-label={t("footer.company")}>
          <p className="text-xs font-semibold uppercase tracking-widest text-white/70">{t("footer.company")}</p>
          <ul className="mt-4 space-y-2.5 text-sm">
            <li><Link href="/apport-affaires" className="hover:text-white">{t("footer.link.partner")}</Link></li>
            <li><Link href="/contact" className="hover:text-white">{t("footer.link.contact")}</Link></li>
            <li><Link href="/devis" className="hover:text-white">{t("footer.link.quote")}</Link></li>
          </ul>
        </nav>

        <nav aria-label={t("footer.clientArea")}>
          <p className="text-xs font-semibold uppercase tracking-widest text-white/70">{t("footer.clientArea")}</p>
          <ul className="mt-4 space-y-2.5 text-sm">
            <li><Link href="/login" className="hover:text-white">{t("footer.link.signin")}</Link></li>
            <li><Link href="/signup" className="hover:text-white">{t("footer.link.signup")}</Link></li>
            <li><Link href="/dashboard" className="hover:text-white">{t("footer.link.dashboard")}</Link></li>
          </ul>
        </nav>
      </div>

      <div className="border-t border-white/10">
        <div className="container-x flex flex-col gap-2 py-5 text-xs text-navy-200/70 sm:flex-row sm:items-center sm:justify-between">
          <p>{t("footer.rights").replace("{year}", String(new Date().getFullYear()))}</p>
          <p>{t("footer.progress")}</p>
        </div>
      </div>
    </footer>
  );
}
