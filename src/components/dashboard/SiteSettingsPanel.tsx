"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getSiteSettings, updateSiteSettings } from "@/lib/api";
import { toUserMessage } from "@/lib/errors";
import { DEFAULT_BRANDING, MAX_CUSTOM_CSS_LENGTH, sanitizeCustomCss } from "@/lib/branding";
import { useI18n } from "@/components/I18nProvider";
import type { SiteSettings } from "@/lib/types";

const inputClass =
  "w-full rounded-lg border border-navy-200 bg-white px-3 py-2.5 text-sm text-navy-900 placeholder:text-navy-400 focus:border-navy-500 focus:outline-none focus:ring-2 focus:ring-navy-100";
const buttonPrimary =
  "rounded-full bg-navy-800 px-4 py-2 text-xs font-semibold text-white hover:bg-navy-700 disabled:opacity-60";
const buttonGhost =
  "rounded-full border border-navy-200 px-4 py-2 text-xs font-semibold text-navy-700 hover:bg-navy-50 disabled:opacity-60";

export default function SiteSettingsPanel() {
  const { t } = useI18n();
  const router = useRouter();
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [logoUrl, setLogoUrl] = useState("");
  const [logoAlt, setLogoAlt] = useState("");
  const [slogan, setSlogan] = useState("");
  const [customCss, setCustomCss] = useState("");
  const [socialFacebook, setSocialFacebook] = useState("");
  const [socialLinkedin, setSocialLinkedin] = useState("");
  const [socialX, setSocialX] = useState("");
  const [socialInstagram, setSocialInstagram] = useState("");
  const [newsletterUrl, setNewsletterUrl] = useState("");
  const [homeHeroImage, setHomeHeroImage] = useState("");
  const [homeVisualImage, setHomeVisualImage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getSiteSettings()
      .then((row) => {
        if (cancelled) return;
        setSettings(row);
        setLogoUrl(row.logo_url ?? "");
        setLogoAlt(row.logo_alt ?? "");
        setSlogan(row.slogan ?? "");
        setCustomCss(row.custom_css ?? "");
        setSocialFacebook(row.social_facebook ?? "");
        setSocialLinkedin(row.social_linkedin ?? "");
        setSocialX(row.social_x ?? "");
        setSocialInstagram(row.social_instagram ?? "");
        setNewsletterUrl(row.newsletter_url ?? "");
        setHomeHeroImage(row.home_hero_image ?? "");
        setHomeVisualImage(row.home_visual_image ?? "");
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(toUserMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /** URL complète obligatoire pour les liens publics de diffusion. */
  function validPublicUrl(raw: string): boolean {
    if (!raw.trim()) return true;
    return /^https?:\/\/\S+$/.test(raw.trim());
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaved(false);
    const socials: Array<[string, string]> = [
      [t("ss.facebook"), socialFacebook],
      [t("ss.linkedin"), socialLinkedin],
      [t("ss.x"), socialX],
      [t("ss.instagram"), socialInstagram],
      [t("ss.newsletter"), newsletterUrl],
      [t("ss.heroImage"), homeHeroImage],
      [t("ss.visualImage"), homeVisualImage],
    ];
    if (socials.some(([, value]) => !validPublicUrl(value))) {
      setError(t("ss.invalidUrl"));
      return;
    }
    setPending(true);
    try {
      const row = await updateSiteSettings({
        logo_url: logoUrl.trim() || null,
        logo_alt: logoAlt.trim() || null,
        slogan: slogan.trim() || null,
        custom_css: sanitizeCustomCss(customCss) || null,
        social_facebook: socialFacebook.trim() || null,
        social_linkedin: socialLinkedin.trim() || null,
        social_x: socialX.trim() || null,
        social_instagram: socialInstagram.trim() || null,
        newsletter_url: newsletterUrl.trim() || null,
        home_hero_image: homeHeroImage.trim() || null,
        home_visual_image: homeVisualImage.trim() || null,
      });
      setSettings(row);
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(toUserMessage(err));
    } finally {
      setPending(false);
    }
  }

  function resetDefaults() {
    setLogoUrl(DEFAULT_BRANDING.logo_url ?? "");
    setLogoAlt(DEFAULT_BRANDING.logo_alt ?? "");
    setSlogan(DEFAULT_BRANDING.slogan ?? "");
    setCustomCss(DEFAULT_BRANDING.custom_css ?? "");
    setSocialFacebook(DEFAULT_BRANDING.social_facebook ?? "");
    setSocialLinkedin(DEFAULT_BRANDING.social_linkedin ?? "");
    setSocialX(DEFAULT_BRANDING.social_x ?? "");
    setSocialInstagram(DEFAULT_BRANDING.social_instagram ?? "");
    setNewsletterUrl(DEFAULT_BRANDING.newsletter_url ?? "");
    setHomeHeroImage(DEFAULT_BRANDING.home_hero_image ?? "");
    setHomeVisualImage(DEFAULT_BRANDING.home_visual_image ?? "");
    setSaved(false);
  }

  if (!settings) {
    return (
      <div className="surface p-6 text-sm text-navy-600">
        {error ?? t("ss.loading")}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <form onSubmit={save} className="surface grid gap-5 p-6">
        <div>
          <h2 className="font-display text-lg font-semibold text-navy-900">
            {t("ss.title")}
          </h2>
          <p className="mt-1 text-sm text-navy-600">
            {t("ss.body")}
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="s-logo-url" className="mb-1 block text-xs font-semibold text-navy-700">
              {t("ss.logoUrl")}
            </label>
            <input
              id="s-logo-url"
              type="text"
              inputMode="url"
              maxLength={2048}
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder={t("ss.logoUrlPh")}
              className={inputClass}
            />
            <p className="mt-1 text-[0.7rem] text-navy-500">
              {t("ss.cssHint")}
            </p>
          </div>
          <div>
            <label htmlFor="s-logo-alt" className="mb-1 block text-xs font-semibold text-navy-700">
              {t("ss.logoAlt")}
            </label>
            <input
              id="s-logo-alt"
              type="text"
              maxLength={120}
              value={logoAlt}
              onChange={(e) => setLogoAlt(e.target.value)}
              placeholder={DEFAULT_BRANDING.logo_alt ?? ""}
              className={inputClass}
            />
          </div>
        </div>

        <div>
          <label htmlFor="s-slogan" className="mb-1 block text-xs font-semibold text-navy-700">
            {t("ss.slogan")}
          </label>
          <input
            id="s-slogan"
            type="text"
            maxLength={160}
            value={slogan}
            onChange={(e) => setSlogan(e.target.value)}
            placeholder={DEFAULT_BRANDING.slogan ?? ""}
            className={inputClass}
          />
        </div>

        <div className="border-t border-navy-100 pt-5">
          <h3 className="text-sm font-semibold text-navy-800">{t("ss.socialTitle")}</h3>
          <p className="mt-1 text-[0.75rem] text-navy-500">{t("ss.socialHint")}</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="s-facebook" className="mb-1 block text-xs font-semibold text-navy-700">
                {t("ss.facebook")}
              </label>
              <input
                id="s-facebook"
                type="text"
                inputMode="url"
                maxLength={2048}
                value={socialFacebook}
                onChange={(e) => setSocialFacebook(e.target.value)}
                placeholder={t("ss.facebookPh")}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="s-linkedin" className="mb-1 block text-xs font-semibold text-navy-700">
                {t("ss.linkedin")}
              </label>
              <input
                id="s-linkedin"
                type="text"
                inputMode="url"
                maxLength={2048}
                value={socialLinkedin}
                onChange={(e) => setSocialLinkedin(e.target.value)}
                placeholder={t("ss.linkedinPh")}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="s-x" className="mb-1 block text-xs font-semibold text-navy-700">
                {t("ss.x")}
              </label>
              <input
                id="s-x"
                type="text"
                inputMode="url"
                maxLength={2048}
                value={socialX}
                onChange={(e) => setSocialX(e.target.value)}
                placeholder={t("ss.xPh")}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="s-instagram" className="mb-1 block text-xs font-semibold text-navy-700">
                {t("ss.instagram")}
              </label>
              <input
                id="s-instagram"
                type="text"
                inputMode="url"
                maxLength={2048}
                value={socialInstagram}
                onChange={(e) => setSocialInstagram(e.target.value)}
                placeholder={t("ss.instagramPh")}
                className={inputClass}
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="s-newsletter" className="mb-1 block text-xs font-semibold text-navy-700">
                {t("ss.newsletter")}
              </label>
              <input
                id="s-newsletter"
                type="text"
                inputMode="url"
                maxLength={2048}
                value={newsletterUrl}
                onChange={(e) => setNewsletterUrl(e.target.value)}
                placeholder={t("ss.newsletterPh")}
                className={inputClass}
              />
            </div>
          </div>
        </div>

        <div className="border-t border-navy-100 pt-5">
          <h3 className="text-sm font-semibold text-navy-800">{t("ss.homeImages")}</h3>
          <p className="mt-1 text-[0.75rem] text-navy-500">{t("ss.homeImagesHint")}</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="s-hero-image" className="mb-1 block text-xs font-semibold text-navy-700">
                {t("ss.heroImage")}
              </label>
              <input
                id="s-hero-image"
                type="text"
                inputMode="url"
                maxLength={2048}
                value={homeHeroImage}
                onChange={(e) => setHomeHeroImage(e.target.value)}
                placeholder={t("ss.heroImagePh")}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="s-visual-image" className="mb-1 block text-xs font-semibold text-navy-700">
                {t("ss.visualImage")}
              </label>
              <input
                id="s-visual-image"
                type="text"
                inputMode="url"
                maxLength={2048}
                value={homeVisualImage}
                onChange={(e) => setHomeVisualImage(e.target.value)}
                placeholder={t("ss.visualImagePh")}
                className={inputClass}
              />
            </div>
          </div>
          {(homeHeroImage || homeVisualImage) && (
            <div className="mt-4 rounded-lg border border-navy-100 bg-white p-3">
              <p className="text-[0.7rem] font-semibold uppercase tracking-widest text-navy-500">
                {t("ss.preview")}
              </p>
              <div className="mt-2 flex gap-3">
                {homeHeroImage && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={homeHeroImage} alt="" className="h-20 w-1/2 rounded-lg object-cover" />
                )}
                {homeVisualImage && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={homeVisualImage} alt="" className="h-20 w-1/2 rounded-lg object-cover" />
                )}
              </div>
            </div>
          )}
        </div>

        <div>
          <label htmlFor="s-css" className="mb-1 block text-xs font-semibold text-navy-700">
            {t("ss.cssTitle")}
          </label>
          <textarea
            id="s-css"
            rows={8}
            maxLength={MAX_CUSTOM_CSS_LENGTH}
            value={customCss}
            onChange={(e) => setCustomCss(e.target.value)}
            placeholder={"/* Exemple : */\n:root { --color-flagred-600: #c8102e; }\n.container-x { max-width: 80rem; }"}
            className={`${inputClass} font-mono text-xs leading-relaxed`}
          />
          <p className="mt-1 text-[0.7rem] text-navy-500">
            {t("ss.chars", { n: customCss.length, m: MAX_CUSTOM_CSS_LENGTH })}
          </p>
        </div>

        {error && (
          <p role="alert" className="rounded-lg border border-flagred-600/30 bg-flagred-50 px-4 py-3 text-sm font-medium text-flagred-700">
            {error}
          </p>
        )}
        {saved && (
          <p role="status" className="rounded-lg border border-navy-200 bg-navy-50 px-4 py-3 text-sm font-medium text-navy-700">
            {t("ss.saved")}
          </p>
        )}

        <div className="flex flex-wrap gap-3">
          <button type="submit" disabled={pending} className={buttonPrimary}>
            {pending ? t("ss.saving") : t("ss.save")}
          </button>
          <button type="button" onClick={resetDefaults} disabled={pending} className={buttonGhost}>
            {t("ss.reset")}
          </button>
        </div>
      </form>

      <div className="surface p-6">
        <h3 className="text-sm font-semibold text-navy-800">{t("ss.preview")}</h3>
        <div className="mt-4 rounded-lg border border-navy-100 bg-white p-4">
          <div className="flex items-center gap-3">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="" className="h-10 w-auto max-w-[10rem] rounded-lg object-contain" />
            ) : (
              <span
                aria-hidden="true"
                className="grid h-10 w-10 place-items-center rounded-lg bg-navy-800 font-display text-lg font-bold text-white"
              >
                FS<span className="text-flagred-600">T</span>
              </span>
            )}
            <span className="leading-tight">
              <span className="block font-display text-[0.95rem] font-semibold tracking-wide text-navy-800">
                FRANCE SANTÉ TRANSPORT
              </span>
              <span className="hidden text-[0.7rem] italic text-navy-600 sm:block">
                {slogan || DEFAULT_BRANDING.slogan}
              </span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
