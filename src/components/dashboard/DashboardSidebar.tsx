"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Avatar from "@/components/Avatar";
import SignOutButton from "@/components/SignOutButton";
import type { Profile } from "@/lib/types";

const NAV = [{ href: "/dashboard", label: "Accueil" }, { href: "/dashboard/requests", label: "Mes demandes" }, { href: "/dashboard/notifications", label: "Notifications" }, { href: "/dashboard/messages", label: "Messages" }, { href: "/dashboard/settings", label: "Parametres" }];

export default function DashboardSidebar({ profile }: { profile: Profile }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const items = (<nav className="flex-1 space-y-1 overflow-y-auto p-3">{NAV.map((item) => { const active = item.href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(item.href); return (<Link key={item.href} href={item.href} onClick={() => setOpen(false)} className={active ? "block rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white" : "block rounded-lg px-3 py-2 text-sm font-medium text-navy-700 hover:bg-navy-50 dark:text-slate-300 dark:hover:bg-white/5"}>{item.label}</Link>); })}</nav>);
  const head = (<div className="flex items-center gap-3 border-b border-navy-100 px-4 py-4 dark:border-white/10"><Avatar name={profile.full_name} email={profile.email} src={profile.avatar_url} size="md" /><div className="min-w-0"><p className="truncate text-sm font-semibold text-navy-900 dark:text-slate-100">{profile.full_name || profile.email}</p><p className="truncate text-xs text-navy-500 dark:text-slate-400">{profile.role}</p></div></div>);
  const foot = (<div className="border-t border-navy-100 p-3 dark:border-white/10"><SignOutButton /></div>);
  return (<>
    <button type="button" onClick={() => setOpen(true)} aria-label="Menu" className="fixed left-3 top-3 z-40 flex h-10 w-10 flex-col items-center justify-center gap-1 rounded-lg bg-slate-900 shadow-lg lg:hidden"><span className="h-0.5 w-5 rounded bg-white" /><span className="h-0.5 w-5 rounded bg-white" /><span className="h-0.5 w-5 rounded bg-white" /></button>
    {open && (<div className="fixed inset-0 z-50 lg:hidden"><div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} /><aside className="absolute left-0 top-0 flex h-full w-64 flex-col bg-white dark:bg-[#0f131b]">{head}{items}{foot}</aside></div>)}
    <aside className="hidden h-full w-64 shrink-0 flex-col border-r border-navy-100 bg-white dark:border-white/10 dark:bg-[#0f131b] lg:flex">{head}{items}{foot}</aside>
  </>);
}
