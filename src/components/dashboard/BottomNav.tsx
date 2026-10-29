"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ICONS: Record<string, React.ReactNode> = {
  home: <path d="M3 11 12 3l9 8M5 10v10h14V10" />,
  courses: <><path d="M3 6h11v9H3z" /><path d="M14 9h4l3 3v3h-7z" /><circle cx="7" cy="18" r="1.6" /><circle cx="17" cy="18" r="1.6" /></>,
  bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 8-3 8h18s-3-1-3-8" /><path d="M10.5 21a2 2 0 0 0 3 0" /></>,
  chat: <path d="M21 12a8 8 0 0 1-11.6 7.1L4 21l1.9-5.4A8 8 0 1 1 21 12Z" />,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
  users: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 21a6.5 6.5 0 0 1 13 0" /><path d="M17 5.5a3.5 3.5 0 0 1 0 7M22 21a6.5 6.5 0 0 0-5-6.3" /></>,
};

const ITEMS = [{ href: "/dashboard/requests", label: "Accueil", icon: "home" }, { href: "/dashboard/orders", label: "Courses", icon: "courses" }, { href: "/dashboard/notifications", label: "Alertes", icon: "bell" }, { href: "/dashboard/messages", label: "Messages", icon: "chat" }, { href: "/dashboard/settings", label: "Compte", icon: "user" }];

const STAFF_ITEMS = [{ href: "/dashboard/requests", label: "Dossiers", icon: "courses" }, { href: "/dashboard/users", label: "Clients", icon: "users" }, { href: "/dashboard/notifications", label: "Alertes", icon: "bell" }, { href: "/dashboard/messages", label: "Messages", icon: "chat" }, { href: "/dashboard/settings", label: "Compte", icon: "user" }];

export default function BottomNav({ role }: { role: string }) {
  const pathname = usePathname();
  const items = role === "admin" || role === "dispatcher" ? STAFF_ITEMS : ITEMS;
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto flex max-w-md items-stretch justify-around border-t border-slate-200 bg-white px-2 pb-[env(safe-area-inset-bottom)] pt-1.5 shadow-[0_-2px_16px_rgba(15,23,42,0.08)]">
      {items.map((it) => {
        const active = pathname.startsWith(it.href);
        return (
          <Link key={it.href} href={it.href} className="flex flex-1 flex-col items-center justify-center gap-1 py-1.5">
            <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke={active ? "#0f172a" : "#94a3b8"} strokeWidth={active ? 2 : 1.7} strokeLinecap="round" strokeLinejoin="round">{ICONS[it.icon]}</svg>
            <span className={active ? "text-[10px] font-semibold text-slate-900" : "text-[10px] font-medium text-slate-400"}>{it.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
