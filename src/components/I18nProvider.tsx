"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { translate, type TKey } from "@/lib/i18n/dictionaries";
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  isLocale,
  type Locale,
} from "@/lib/i18n/locale";
import { getLabels, type Labels } from "@/lib/labels";

interface I18nContextValue {
  locale: Locale;
  t: (key: TKey, vars?: Record<string, string | number>) => string;
  labels: Labels;
  setLocale: (locale: Locale) => void;
}

const defaultLocale = DEFAULT_LOCALE;

const I18nContext = createContext<I18nContextValue>({
  locale: defaultLocale,
  t: (key, vars) => translate(defaultLocale, key, vars),
  labels: getLabels(defaultLocale),
  setLocale: () => undefined,
});

/**
 * Fournit la locale courante (cookie `locale`) à tout le CLIENT :
 * `const { t, locale, labels, setLocale } = useI18n()`.
 * Les composants serveur lisent le cookie via `getLocale()` de
 * `@/lib/i18n/server` et appellent `translate(locale, key)`.
 */
export default function I18nProvider({
  initialLocale,
  children,
}: {
  initialLocale: Locale;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [locale, setLocaleState] = useState<Locale>(
    isLocale(initialLocale) ? initialLocale : defaultLocale,
  );

  const setLocale = useCallback(
    (next: Locale) => {
      setLocaleState(next);
      if (typeof document !== "undefined") {
        document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
      }
      router.refresh();
    },
    [router],
  );

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      t: (key: TKey, vars?: Record<string, string | number>) => translate(locale, key, vars),
      labels: getLabels(locale),
      setLocale,
    }),
    [locale, setLocale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  return useContext(I18nContext);
}
