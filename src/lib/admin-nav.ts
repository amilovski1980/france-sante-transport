import type { Profile } from "@/lib/types";

export type AdminNavItem = {
  href: string;
  label: string;
  icon: string;
  exact?: boolean;
  adminOnly?: boolean;
};

export type AdminNavGroup = {
  label: string;
  items: AdminNavItem[];
};

export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  {
    label: "Pilotage",
    items: [
      { href: "/dashboard/admin", label: "Vue d'ensemble", icon: "📊", exact: true },
      { href: "/dashboard/requests", label: "Dossiers", icon: "📋" },
      { href: "/dashboard/admin/agenda", label: "Agenda & missions", icon: "📅" },
    ],
  },
  {
    label: "Clients & partenaires",
    items: [
      { href: "/dashboard/clients", label: "CRM Clients", icon: "🗂️" },
      { href: "/dashboard/partners", label: "Apports d'affaires", icon: "🤝" },
      { href: "/dashboard/users", label: "Comptes", icon: "👥", adminOnly: true },
    ],
  },
  {
    label: "Logistique",
    items: [
      { href: "/dashboard/admin/suppliers", label: "Fournisseurs", icon: "🏭" },
      { href: "/dashboard/admin/warehouses", label: "Entrepôts", icon: "📦" },
      { href: "/dashboard/admin/recipients", label: "Destinataires", icon: "📍" },
      { href: "/dashboard/admin/preparation", label: "Préparations", icon: "📝" },
      { href: "/dashboard/admin/deliveries", label: "Livraisons", icon: "🚚" },
    ],
  },
  {
    label: "Exploitation",
    items: [
      { href: "/dashboard/admin/fleet", label: "Flotte", icon: "🏍️" },
      { href: "/dashboard/admin/services", label: "Services & API", icon: "🔌" },
    ],
  },
  {
    label: "Finance",
    items: [{ href: "/dashboard/invoices", label: "Factures", icon: "🧾" }],
  },
  {
    label: "Communication",
    items: [
      { href: "/dashboard/messages", label: "Messagerie", icon: "💬" },
      { href: "/dashboard/notifications", label: "Notifications", icon: "🔔" },
      { href: "/dashboard/admin/mailing", label: "Mailing", icon: "✉️" },
    ],
  },
  {
    label: "Configuration",
    items: [
      { href: "/dashboard/admin/site", label: "Paramètres du site", icon: "🎨", adminOnly: true },
      { href: "/dashboard/settings", label: "Paramètres", icon: "⚙️" },
    ],
  },
];

export function adminNavItems(role: Profile["role"]): AdminNavItem[] {
  return ADMIN_NAV_GROUPS.flatMap((group) => group.items).filter(
    (item) => !item.adminOnly || role === "admin",
  );
}

export function isAdminNavItemActive(pathname: string, item: AdminNavItem): boolean {
  return item.exact
    ? pathname === item.href
    : pathname === item.href || pathname.startsWith(`${item.href}/`);
}
