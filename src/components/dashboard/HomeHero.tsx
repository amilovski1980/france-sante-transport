"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/components/I18nProvider";
import type { Profile } from "@/lib/types";

const DEFAULT_BG =
  "linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.5)), url('https://images.unsplash.com/photo-1581091012184-7e0c9a8a194c?ixlib=rb-4.0.3&auto=format&fit=crop&w=1600&q=80')";

export default function HomeHero({ profile, pending, active, heroImageUrl }: {
  profile: Profile;
  pending: number;
  active: number;
  heroImageUrl?: string;
}) {
  const { t } = useI18n();
  const [bgStyle, setBgStyle] = useState<any>({});

  useEffect(() => {
    if (heroImageUrl) {
      // Image en plein écran avec overlay noir à 30 %
      setBgStyle({
        backgroundImage: `url('${heroImageUrl}')`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        // overlay noir semi-transparent via filter (plus simple que overlay div)
        filter: "brightness(0.6)",
      });
    } else {
      // style par défaut (sans image)
      setBgStyle("");
    }
  }, [heroImageUrl]);

  return (
    <div className="relative min-h-screen">
      {/* Image d'héro (fond) */}
      {heroImageUrl && (
        <div
          className="absolute inset-0"
          style={bgStyle}
        />
      )}

      {/* Contenu principal – on le place au-dessus de l'image */}
      <div className="relative z-10 min-h-screen flex flex-col items-center py-8">
        <div className="rounded-2xl bg-slate-900/80 p-5 text-white shadow-lg sm:p-6 w-full max-w-3xl">
          <p className="text-xs uppercase tracking-widest text-slate-400">{t("home.hello")}</p>
          <h1 className="mt-1 text-lg font-bold sm:text-2xl">{profile.full_name || profile.email}</h1>
          <p className="mt-1 text-xs text-slate-400 sm:text-sm">{t("home.subtitle")}</p>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="rounded-xl bg-white/10 p-2 text-center sm:p-3"><p className="text-lg font-bold sm:text-xl">{pending}</p><p className="text-[10px] text-slate-300 sm:text-xs">{t("home.pending")}</p></div>
            <div className="rounded-xl bg-white/10 p-2 text-center sm:p-3"><p className="text-lg font-bold sm:text-xl">{active}</p><p className="text-[10px] text-slate-300 sm:text-xs">{t("home.active")}</p></div>
            <div className="rounded-xl bg-white/10 p-2 text-center sm:p-3"><p className="text-lg font-bold sm:text-xl">24/7</p><p className="text-[10px] text-slate-300 sm:text-xs">{t("home.support")}</p></div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3 mt-6">
          <Link href="/dashboard/requests" className="rounded-xl bg-white p-3 text-center text-xs font-semibold text-slate-800 shadow-sm hover:shadow-md sm:text-sm">Mes demandes</Link>
          <Link href="/dashboard/notifications" className="rounded-xl bg-white p-3 text-center text-xs font-semibold text-slate-800 shadow-sm hover:shadow-md sm:text-sm">Notifications</Link>
          <Link href="/dashboard/messages" className="rounded-xl bg-white p-3 text-center text-xs font-semibold text-slate-800 shadow-sm hover:shadow-md sm:text-sm">Messages</Link>
          <Link href="/dashboard/settings" className="rounded-xl bg-white p-3 text-center text-xs font-semibold text-slate-800 shadow-sm hover:shadow-md sm:text-sm">Parametres</Link>
        </div>
      </div>
    </div>
  );
}