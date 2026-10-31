import Link from "next/link";
import type { BrandingSettings } from "@/lib/branding";
import { DEFAULT_BRANDING } from "@/lib/branding";
import { getLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n/dictionaries";
import type { TKey } from "@/lib/i18n/dictionaries";

type SocialLink = { key: "facebook" | "linkedin" | "x" | "instagram"; url: string; label: string };

/**
 * Icônes dans la fonte du système : paths officiels « simple-icons »,
 * rendus en currentColor pour s'adapter au thème du footer.
 */
const SOCIAL_PATHS = {
  facebook:
    "M24 12.073c0-6.627-5.372-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z",
  linkedin:
    "M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.225 0z",
  x: "M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z",
  instagram:
    "M7.8 2h8.4C19.4 2 22 4.6 22 7.8v8.4a5.8 5.8 0 0 1-5.8 5.8H7.8C4.6 22 2 19.4 2 16.2V7.8A5.8 5.8 0 0 1 7.8 2m-.2 2A3.6 3.6 0 0 0 4 7.6v8.8C4 18.39 5.61 20 7.6 20h8.8a3.6 3.6 0 0 0 3.6-3.6V7.6C20 5.61 18.39 4 16.4 4H7.6m9.65 1.5a1.25 1.25 0 0 1 1.25 1.25A1.25 1.25 0 0 1 17.25 8 1.25 1.25 0 0 1 16 6.75a1.25 1.25 0 0 1 1.25-1.25M12 7a5 5 0 0 1 5 5 5 5 0 0 1-5 5 5 5 0 0 1-5-5 5 5 0 0 1 5-5m0 2a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3",
} as const;

export default async function Footer({ branding }: { branding?: BrandingSettings }) {
  const locale = await getLocale();
  const t = (key: TKey) => translate(locale, key);
  const slogan = branding?.slogan || DEFAULT_BRANDING.slogan;

  const socials: SocialLink[] = [
    { key: "facebook", url: branding?.social_facebook || "", label: "Facebook" },
    { key: "linkedin", url: branding?.social_linkedin || "", label: "LinkedIn" },
    { key: "x", url: branding?.social_x || "", label: "X (Twitter)" },
    { key: "instagram", url: branding?.social_instagram || "", label: "Instagram" },
  ].filter((s): s is SocialLink => Boolean(s.url));

  return (
    <footer className="border-t border-navy-800/10 bg-navy-900 text-navy-100">
      <div className="container-x grid gap-10 py-14 md:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr_1fr]">
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

        {(socials.length > 0 || branding?.newsletter_url) && (
          <nav aria-label={t("footer.social")}>
            <p className="text-xs font-semibold uppercase tracking-widest text-white/70">{t("footer.social")}</p>
            <ul className="mt-4 space-y-2.5 text-sm">
              {socials.map((social) => (
                <li key={social.key}>
                  <a
                    href={social.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2.5 hover:text-white"
                  >
                    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 shrink-0 fill-current">
                      <path d={SOCIAL_PATHS[social.key]} />
                    </svg>
                    {social.label}
                  </a>
                </li>
              ))}
              {branding?.newsletter_url && (
                <li>
                  <a
                    href={branding.newsletter_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2.5 hover:text-white"
                  >
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 24 24"
                      className="h-4 w-4 shrink-0 fill-none stroke-current"
                      strokeWidth={1.8}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
                      <path d="M3 7l9 6 9-6" />
                    </svg>
                    {t("footer.newsletter")}
                  </a>
                </li>
              )}
            </ul>
          </nav>
        )}
      </div>

      <div className="border-t border-white/10">
        <div className="container-x flex flex-col gap-2 py-5 text-xs text-navy-200/70 sm:flex-row sm:items-center sm:justify-between">
          <p>{t("footer.rights").replace("{year}", String(new Date().getFullYear()))}</p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <Link href="/cgv" className="hover:text-white">{t("footer.link.cgv")}</Link>
            <span aria-hidden="true">·</span>
            <p>{t("footer.progress")}</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
