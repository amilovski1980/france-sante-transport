"use client";

import Link from "next/link";
import { useI18n } from "@/components/I18nProvider";
import type { Profile } from "@/lib/types";

export default function HomeHero({ profile, pending, active }: { profile: Profile; pending: number; active: number }) {
  const { t } = useI18n();
  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-slate-900 p-5 text-white shadow-lg sm:p-6">
        <p className="text-xs uppercase tracking-widest text-slate-400">{t("home.hello")}</p>
        <h1 className="mt-1 text-lg font-bold sm:text-2xl">{profile.full_name || profile.email}</h1>
        <p className="mt-1 text-xs text-slate-400 sm:text-sm">{t("home.subtitle")}</p>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="rounded-xl bg-white/10 p-2 text-center sm:p-3"><p className="text-lg font-bold sm:text-xl">{pending}</p><p className="text-[10px] text-slate-300 sm:text-xs">{t("home.pending")}</p></div>
          <div className="rounded-xl bg-white/10 p-2 text-center sm:p-3"><p className="text-lg font-bold sm:text-xl">{active}</p><p className="text-[10px] text-slate-300 sm:text-xs">{t("home.active")}</p></div>
          <div className="rounded-xl bg-white/10 p-2 text-center sm:p-3"><p className="text-lg font-bold sm:text-xl">24/7</p><p className="text-[10px] text-slate-300 sm:text-xs">{t("home.support")}</p></div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        <Link href="/dashboard/requests" className="rounded-xl bg-white p-3 text-center text-xs font-semibold text-slate-800 shadow-sm hover:shadow-md sm:text-sm">Mes demandes</Link>
        <Link href="/dashboard/notifications" className="rounded-xl bg-white p-3 text-center text-xs font-semibold text-slate-800 shadow-sm hover:shadow-md sm:text-sm">Notifications</Link>
        <Link href="/dashboard/messages" className="rounded-xl bg-white p-3 text-center text-xs font-semibold text-slate-800 shadow-sm hover:shadow-md sm:text-sm">Messages</Link>
        <Link href="/dashboard/settings" className="rounded-xl bg-white p-3 text-center text-xs font-semibold text-slate-800 shadow-sm hover:shadow-md sm:text-sm">Parametres</Link>
      </div>
    </div>
  );
}
