"use client";

import Link from "next/link";
import { useI18n } from "@/components/I18nProvider";

/**
 * Barre d'action collante en bas d'écran (mobile uniquement) :
 * CTA principal à portée de pouce (Loi de Fitts), style glass premium.
 */
export default function MobileCtaBar() {
  const { t } = useI18n();
  return (
    <div
      className="fixed inset-x-0 bottom-0 z-40 border-t border-navy-100 bg-white/85 px-4 pt-2.5 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur-md md:hidden"
      aria-label={t("cta.quote")}
    >
      <Link
        href="/devis"
        className="relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-navy-900 px-6 py-3.5 text-sm font-medium text-white shadow-lg transition-all active:scale-[0.98]"
      >
        {/* Voile glass premium */}
        <span aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-white/10 to-transparent" />
        {t("cta.quote")}
      </Link>
    </div>
  );
}
