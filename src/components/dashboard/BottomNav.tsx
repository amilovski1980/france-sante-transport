"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ICONS: Record<string, React.ReactNode> = {
  home: <path d="M3 11 12 3l9 8M5 10v10h14V10" />,
  courses: <><path d="M3 6h11v9H3z" /><path d="M14 9h4l3 3v3h-7z" /><circle cx="7" cy="18" r="1.6" /><circle cx="17" cy="18" r="1.6" /></>,
  bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 8-3 8h18s-3-1-3-8" /><path d="M10.5 21a2 2 0 0 0 3 0" /></>,
  chat: <path d="M21 12a8 8 0 0 1-11.6 7.1L4 21l1.9-5.4A8 8 0 1 1 21 12Z" />,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
  users: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 21a6.5 6.5 0 0 1 13 0" /><circle cx="17" cy="9" r="3" /><path d="M21.5 21a6 6 0 0 0-4.7-5.4" /></>,
};

const ITEMS = [
  { href: "/dashboard/requests", label: "Accueil", icon: "home" },
  { href: "/dashboard/orders", label: "Courses", icon: "courses" },
  { href: "/dashboard/notifications", label: "Alertes", icon: "bell" },
  { href: "/dashboard/messages", label: "Messages", icon: "chat" },
  { href: "/dashboard/settings", label: "Compte", icon: "user" },
];

const DRIVER_ITEMS = [
  { href: "/dashboard", label: "Missions", icon: "courses" },
  { href: "/dashboard/notifications", label: "Alertes", icon: "bell" },
  { href: "/dashboard/messages", label: "Messages", icon: "chat" },
  { href: "/dashboard/settings", label: "Compte", icon: "user" },
];

const PARTNER_ITEMS = [
  { href: "/dashboard/partners", label: "Apports", icon: "users" },
  { href: "/dashboard/notifications", label: "Alertes", icon: "bell" },
  { href: "/dashboard/messages", label: "Messages", icon: "chat" },
  { href: "/dashboard/settings", label: "Compte", icon: "user" },
];

const STAFF_ITEMS = [
  { href: "/dashboard/admin", label: "Console", icon: "home" },
  { href: "/dashboard/requests", label: "Dossiers", icon: "courses" },
  { href: "/dashboard/notifications", label: "Alertes", icon: "bell" },
  { href: "/dashboard/messages", label: "Messages", icon: "chat" },
  { href: "/dashboard/settings", label: "Compte", icon: "user" },
];

export default function BottomNav({ role }: { role: string }) {
  const pathname = usePathname();
  const items =
    role === "admin" || role === "dispatcher"
      ? STAFF_ITEMS
      : role === "driver"
        ? DRIVER_ITEMS
        : role === "partner"
          ? PARTNER_ITEMS
          : ITEMS;
  // Le staff dispose d'une latérale sur écran md+ : la barre basse est
  // reservée au mobile.
  const hideOnDesktop = role === "admin" || role === "dispatcher" ? "md:hidden" : "";
  return (
    <nav className={`fixed inset-x-3 bottom-3 z-40 sm:inset-x-auto sm:left-1/2 sm:right-auto sm:-translate-x-1/2 sm:w-96 ${hideOnDesktop} mx-auto flex max-w-md items-stretch justify-around rounded-2xl border border-slate-200/80 bg-white/95 px-2 py-2 shadow-[0_8px_32px_rgba(6,26,51,0.16)] backdrop-blur-md dark:border-white/10 dark:bg-[#12161f]/95 dark:shadow-[0_8px_32px_rgba(0,0,0,0.5)]`}>
      {items.map((it) => {
        const active = it.href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(it.href);
        return (
          <Link
            key={it.href}
            href={it.href}
            aria-current={active ? "page" : undefined}
            className={
              active
                ? "flex flex-1 flex-col items-center justify-center gap-1 rounded-xl bg-navy-700 py-2 text-white shadow-sm transition-colors dark:bg-white/15"
                : "flex flex-1 flex-col items-center justify-center gap-1 rounded-xl py-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-slate-200"
            }
          >
            <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.1 : 1.7} strokeLinecap="round" strokeLinejoin="round">{ICONS[it.icon]}</svg>
            <span className={`text-[10px] leading-none ${active ? "font-semibold" : "font-medium"}`}>{it.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
