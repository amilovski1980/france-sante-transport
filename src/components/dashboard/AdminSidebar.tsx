"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/dashboard/admin", label: "Vue d'ensemble", icon: "📊", exact: true },
  { href: "/dashboard/requests", label: "Dossiers", icon: "📋" },
  { href: "/dashboard/clients", label: "CRM Clients", icon: "🗂️" },
  { href: "/dashboard/partners", label: "Apports d'affaires", icon: "🤝" },
  { href: "/dashboard/invoices", label: "Factures", icon: "🧾" },
  { href: "/dashboard/admin/mailing", label: "Mailing", icon: "✉️" },
  { href: "/dashboard/messages", label: "Messagerie", icon: "💬" },
  { href: "/dashboard/admin/agenda", label: "Agenda", icon: "📅" },
  { href: "/dashboard/users", label: "Comptes", icon: "👥" },
  { href: "/dashboard/admin/fleet", label: "Flotte", icon: "🚐" },
  { href: "/dashboard/admin/services", label: "Services & API", icon: "🔌" },
  { href: "/dashboard/admin/site", label: "Paramètres du site", icon: "🎨" },
  { href: "/dashboard/settings", label: "Paramètres", icon: "⚙️" },
];

export default function AdminSidebar() {
  const pathname = usePathname();
  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-slate-200 bg-white lg:flex dark:border-white/10 dark:bg-[#0f131b]">
      <div className="border-b border-slate-100 px-5 py-5 dark:border-white/10">
        <p className="text-xs font-bold uppercase tracking-widest text-flagred-600">Console</p>
        <p className="mt-1 text-lg font-bold text-slate-900 dark:text-white">Administration</p>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {ITEMS.map((it) => {
          const active = it.exact ? pathname === it.href : pathname.startsWith(it.href);
          return (
            <Link
              key={it.href}
              href={it.href}
              aria-current={active ? "page" : undefined}
              className={
                active
                  ? "flex items-center gap-3 rounded-xl bg-navy-700 px-3 py-2.5 text-sm font-semibold text-white shadow-[0_6px_16px_rgba(14,42,87,0.28)]"
                  : "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-slate-100"
              }
            >
              <span className="w-5 text-center text-base">{it.icon}</span>
              {it.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-slate-100 p-3 dark:border-white/10">
        <p className="px-3 py-2 text-xs text-slate-400">France Santé Transport · Console interne</p>
      </div>
    </aside>
  );
}
