export type Locale = "fr" | "en";

export const LOCALES: Locale[] = ["fr", "en"];
export const LOCALE_COOKIE = "locale";
export const DEFAULT_LOCALE: Locale = "fr";

export function isLocale(value: unknown): value is Locale {
  return value === "fr" || value === "en";
}
