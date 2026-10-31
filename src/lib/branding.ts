export interface BrandingSettings {
  logo_url: string | null;
  logo_alt: string | null;
  slogan: string | null;
  custom_css: string | null;
  social_facebook: string | null;
  social_linkedin: string | null;
  social_x: string | null;
  social_instagram: string | null;
  newsletter_url: string | null;
  home_hero_image: string | null;
  home_visual_image: string | null;
}

export const DEFAULT_BRANDING: BrandingSettings = {
  logo_url: null,
  logo_alt: "France Santé Transport",
  slogan: "Le transport qui fait avancer la santé",
  custom_css: null,
  social_facebook: null,
  social_linkedin: null,
  social_x: null,
  social_instagram: null,
  newsletter_url: null,
  home_hero_image: null,
  home_visual_image: null,
};

export const MAX_CUSTOM_CSS_LENGTH = 10000;

/**
 * Assainit le CSS sur mesure avant injection dans la page :
 * suppression des séquences qui pourraient fermer la balise <style>
 * ou commenter la suite du document. Longueur bornée.
 */
export function sanitizeCustomCss(css: string | null | undefined): string {
  if (!css) return "";
  return css
    .slice(0, MAX_CUSTOM_CSS_LENGTH)
    .replace(/<\/style/gi, "")
    .replace(/<!--/g, "")
    .trim();
}

export function resolveBranding(row: Partial<BrandingSettings> | null | undefined): BrandingSettings {
  if (!row) return DEFAULT_BRANDING;
  return {
    logo_url: row.logo_url?.trim() || null,
    logo_alt: row.logo_alt?.trim() || DEFAULT_BRANDING.logo_alt,
    slogan: row.slogan?.trim() || DEFAULT_BRANDING.slogan,
    custom_css: sanitizeCustomCss(row.custom_css) || null,
    social_facebook: row.social_facebook?.trim() || null,
    social_linkedin: row.social_linkedin?.trim() || null,
    social_x: row.social_x?.trim() || null,
    social_instagram: row.social_instagram?.trim() || null,
    newsletter_url: row.newsletter_url?.trim() || null,
    home_hero_image: row.home_hero_image?.trim() || null,
    home_visual_image: row.home_visual_image?.trim() || null,
  };
}
