"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import type { BrandingSettings } from "@/lib/branding";
import { DEFAULT_BRANDING } from "@/lib/branding";
import type { Profile } from "@/lib/types";
import { useI18n } from "@/components/I18nProvider";
import ThemeToggle from "@/components/ThemeToggle";
import { LOCALES, type Locale } from "@/lib/i18n/locale";
import type { TKey } from "@/lib/i18n/dictionaries";

const NAV_LINKS: { href: string; key: TKey }[] = [
  { href: "/", key: "nav.home" },
  { href: "/services", key: "nav.services" },
  { href: "/flotte", key: "nav.fleet" },
  { href: "/apport-affaires", key: "nav.partner" },
  { href: "/contact", key: "nav.contact" },
];

function LanguageSwitcher() {
  const { t, locale, setLocale } = useI18n();
  return (
    <div
      className="flex items-center rounded-full border border-navy-200 p-0.5"
      role="group"
      aria-label={t("lang.label")}
    >
      {LOCALES.map((l: Locale) => (
        <button
          key={l}
          type="button"
          onClick={() => setLocale(l)}
          aria-pressed={locale === l}
          className={`rounded-full px-2.5 py-1 text-[0.7rem] font-bold tracking-wider transition-colors ${
            locale === l ? "bg-navy-800 text-white" : "text-navy-500 hover:text-navy-900"
          }`}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

export function Logo({
  compact = false,
  branding,
}: {
  compact?: boolean;
  branding?: BrandingSettings;
}) {
  const { t } = useI18n();
  const logoUrl = branding?.logo_url ?? null;
  const logoAlt = branding?.logo_alt || DEFAULT_BRANDING.logo_alt || "France Santé Transport";
  const slogan = branding?.slogan || DEFAULT_BRANDING.slogan || "Le transport qui fait avancer la santé";

  return (
    <Link href="/" className="group flex items-center gap-3" aria-label={`France Santé Transport — ${t("nav.home")}`}>
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoUrl}
          alt={logoAlt}
          className="h-10 w-auto max-w-[10rem] rounded-lg object-contain transition-transform duration-300 group-hover:-translate-y-0.5"
        />
      ) : (
        <span
          aria-hidden="true"
          className="grid h-10 w-10 place-items-center rounded-lg bg-navy-800 font-display text-lg font-bold text-white transition-transform duration-300 group-hover:-translate-y-0.5"
        >
          FS<span className="text-flagred-600">T</span>
        </span>
      )}
      <span className="leading-tight">
        <span className="block font-display text-[0.95rem] font-semibold tracking-wide text-navy-800 sm:text-base">
          FRANCE SANTÉ TRANSPORT
        </span>
        {!compact && (
          <span className="hidden text-[0.7rem] italic text-navy-600 sm:block">{slogan}</span>
        )}
      </span>
    </Link>
  );
}

export default function Header({ branding }: { branding?: BrandingSettings }) {
  const pathname = usePathname();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<Profile["role"] | null>(null);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user: u } }) => {
      setUser(u);
      if (u) {
        const { data } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", u.id)
          .single();
        setRole(data?.role ?? "client");
      } else {
        setRole(null);
      }
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (!session?.user) setRole(null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <header className="sticky top-0 z-50 border-b border-navy-100 bg-white/90 backdrop-blur-md">
      <div className="container-x flex h-20 items-center justify-between gap-4">
        <Logo branding={branding} />

        <nav className="hidden items-center gap-1 lg:flex" aria-label={t("nav.main")}>
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-full px-3.5 py-2 text-sm font-medium transition-colors ${
                isActive(link.href)
                  ? "bg-navy-50 text-navy-800"
                  : "text-navy-700 hover:bg-navy-50 hover:text-navy-900"
              }`}
            >
              {t(link.key)}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle /><LanguageSwitcher />
          <Link
            href="/devis"
            className="hidden rounded-full bg-flagred-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-flagred-700 sm:inline-flex"
          >
            {t("cta.quote")}
          </Link>

          {user ? (
            <Link
              href="/dashboard"
              className="hidden rounded-full border border-navy-200 px-5 py-2.5 text-sm font-semibold text-navy-800 transition-colors hover:bg-navy-50 sm:inline-flex"
            >
              {role === "admin" || role === "dispatcher" ? t("cta.console") : t("cta.mySpace")}
            </Link>
          ) : (
            <Link
              href="/login"
              className="hidden rounded-full border border-navy-200 px-5 py-2.5 text-sm font-semibold text-navy-800 transition-colors hover:bg-navy-50 sm:inline-flex"
            >
              {t("cta.signin")}
            </Link>
          )}

          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="grid h-11 w-11 place-items-center rounded-lg border border-navy-200 text-navy-800 lg:hidden"
            aria-expanded={open}
            aria-label={open ? t("menu.close") : t("menu.open")}
          >
            <span className="relative block h-3.5 w-5">
              <span
                className={`absolute left-0 h-0.5 w-full bg-navy-800 transition-all ${open ? "top-1.5 rotate-45" : "top-0"}`}
              />
              <span
                className={`absolute left-0 top-1.5 h-0.5 w-full bg-navy-800 transition-all ${open ? "opacity-0" : "opacity-100"}`}
              />
              <span
                className={`absolute left-0 h-0.5 w-full bg-navy-800 transition-all ${open ? "top-1.5 -rotate-45" : "top-3"}`}
              />
            </span>
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-navy-100 bg-white lg:hidden">
          <nav className="container-x flex flex-col gap-1 py-4" aria-label={t("nav.mobile")}>
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-lg px-3 py-3 text-sm font-medium ${
                  isActive(link.href) ? "bg-navy-50 text-navy-900" : "text-navy-700 hover:bg-navy-50"
                }`}
              >
                {t(link.key)}
              </Link>
            ))}
            <div className="mt-2 flex justify-center">
              <ThemeToggle /><LanguageSwitcher />
            </div>
            <Link
              href="/devis"
              className="mt-2 rounded-lg bg-flagred-600 px-3 py-3 text-center text-sm font-semibold text-white"
            >
              {t("cta.quote")}
            </Link>
            <Link
              href={user ? "/dashboard" : "/login"}
              className="mt-1 rounded-lg border border-navy-200 px-3 py-3 text-center text-sm font-semibold text-navy-800"
            >
              {user ? t("cta.mySpace") : t("cta.signin")}
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
