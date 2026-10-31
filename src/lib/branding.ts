export interface BrandingSettings {
  logo_url: string | null;
  logo_alt: string | null;
  slogan: string | null;
  custom_css: string | null;
}

export const DEFAULT_BRANDING: BrandingSettings = {
  logo_url: null,
  logo_alt: "France Santé Transport",
  slogan: "Le transport qui fait avancer la santé",
  custom_css: null,
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
  };
}
