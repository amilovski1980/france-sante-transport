"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Profile } from "@/lib/types";
import { ADMIN_NAV_GROUPS, isAdminNavItemActive } from "@/lib/admin-nav";
import { NavGlyph } from "@/components/dashboard/NavIcon";

export default function AdminSidebar({ role }: { role: Profile["role"] }) {
  const pathname = usePathname();
  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-slate-200 bg-white lg:flex dark:border-white/10 dark:bg-[#0f131b]">
      <div className="border-b border-slate-100 px-5 py-5 dark:border-white/10">
        <p className="text-xs font-bold uppercase tracking-widest text-flagred-600">Console</p>
        <p className="mt-1 text-lg font-bold text-slate-900 dark:text-white">Administration</p>
      </div>
      <nav className="flex-1 space-y-3 overflow-y-auto p-3">
        {ADMIN_NAV_GROUPS.map((group) => {
          const items = group.items.filter((item) => !item.adminOnly || role === "admin");
          if (items.length === 0) return null;
          return (
            <div key={group.label}>
              <p className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                {group.label}
              </p>
              <div className="space-y-1">
                {items.map((item) => {
                  const active = isAdminNavItemActive(pathname, item);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={
                        active
                          ? "flex items-center gap-3 rounded-xl bg-navy-700 px-3 py-2.5 text-sm font-semibold text-white shadow-[0_6px_16px_rgba(14,42,87,0.28)]"
                          : "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-slate-100"
                      }
                    >
                      <span className="w-5 text-center text-slate-400 dark:text-slate-300 [&_svg]:mx-auto [&_svg]:h-[1.05rem] [&_svg]:w-[1.05rem]">
                        <NavGlyph glyph={item.icon} />
                      </span>
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>
      <div className="border-t border-slate-100 p-3 dark:border-white/10">
        <p className="px-3 py-2 text-xs text-slate-400">France Santé Transport · Console interne</p>
      </div>
    </aside>
  );
}
