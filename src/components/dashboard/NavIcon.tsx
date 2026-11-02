/**
 * Icônes SVG monochromes (trait, currentColor) pour la navigation et les
 * indicateurs : une seule couleur — gris par défaut, bleu marine si accent.
 * Remplace les emojis système (rendu aléatoire selon l'OS).
 */
export type NavIconName =
  | "chart"
  | "list"
  | "calendar"
  | "folder"
  | "handshake"
  | "users"
  | "truck"
  | "plug"
  | "receipt"
  | "chat"
  | "bell"
  | "mail"
  | "palette"
  | "settings"
  | "money"
  | "trend"
  | "clock"
  | "pin"
  | "phone"
  | "plus"
  | "edit"
  | "trash"
  | "snow"
  | "check"
  | "close"
  | "search"
  | "send"
  | "box"
  | "ban"
  | "download"
  | "refresh"
  | "paperclip"
  | "wallet"
  | "user"
  | "vehicle"
  | "rider";

const PATHS: Record<NavIconName, string[]> = {
  chart: ["M18 20V10", "M12 20V4", "M6 20v-6"],
  list: [
    "M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2",
    "M9 2h6a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z",
    "M9 12h6",
    "M9 16h6",
  ],
  calendar: ["M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z", "M16 3v4", "M8 3v4", "M3 11h18"],
  folder: ["M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"],
  handshake: ["M11 17l2 2a1 1 0 0 0 2 0l4-4", "M4 10l4-4a2 2 0 0 1 3 0l2 2 2-2a2 2 0 0 1 3 0l4 4"],
  users: [
    "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2",
    "M9 3a4 4 0 1 0 0 8a4 4 0 0 0 0-8z",
    "M23 21v-2a4 4 0 0 0-3-3.87",
    "M16 3.13a4 4 0 0 1 0 7.75",
  ],
  truck: ["M1 4h14v11H1z", "M15 8h4l3 3v4h-7V8z", "M5 17.5a2.5 2.5 0 1 0 0-5a2.5 2.5 0 0 0 0 5z", "M18 17.5a2.5 2.5 0 1 0 0-5a2.5 2.5 0 0 0 0 5z"],
  plug: ["M13 2 3 14h9l-1 8 10-12h-9l1-8z"],
  receipt: ["M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z", "M14 2v6h6", "M9 13h6", "M9 17h6", "M9 9h1"],
  chat: ["M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8z"],
  bell: ["M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9", "M13.73 21a2 2 0 0 1-3.46 0"],
  mail: ["M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z", "M22 6l-10 7L2 6"],
  palette: [
    "M12 21a9 9 0 1 1 9-9c0 4-3 4-4.5 4h-1c-1 0-2 1-2 2.5S14 21 12 21z",
    "M7.5 10.5h.01",
    "M12 7.5h.01",
    "M16.5 10.5h.01",
  ],
  settings: ["M12 15a3 3 0 1 0 0-6a3 3 0 0 0 0 6z", "M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"],
  money: ["M2 6h20v12H2z", "M12 10a2 2 0 1 0 0 4a2 2 0 0 0 0-4z", "M6 12h.01", "M18 12h.01"],
  trend: ["M23 6l-9.5 9.5-5-5L1 18", "M17 6h6v6"],
  clock: ["M12 22a10 10 0 1 0 0-20a10 10 0 0 0 0 20z", "M12 6v6l4 2"],
  pin: ["M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z", "M12 13a3 3 0 1 0 0-6a3 3 0 0 0 0 6z"],
  phone: ["M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"],
  plus: ["M12 5v14", "M5 12h14"],
  edit: ["M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z"],
  trash: ["M3 6h18", "M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2", "M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6", "M10 11v6", "M14 11v6"],
  snow: ["M12 2v20", "M20 7 4 17", "M4 7l16 10"],
  check: ["M20 6L9 17l-5-5"],
  close: ["M18 6L6 18", "M6 6l12 12"],
  search: ["M11 19a8 8 0 1 0 0-16a8 8 0 0 0 0 16z", "M21 21l-4.35-4.35"],
  send: ["M22 2L11 13", "M22 2l-7 20-4-9-9-4 20-7z"],
  box: ["M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z", "M3.27 6.96 12 12.01l8.73-5.05", "M12 22.08V12"],
  ban: ["M12 22a10 10 0 1 0 0-20a10 10 0 0 0 0 20z", "M4.93 4.93l14.14 14.14"],
  download: ["M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4", "M7 10l5 5 5-5", "M12 15V3"],
  refresh: ["M1 4v6h6", "M3.51 15a9 9 0 1 0 2.13-9.36L1 10"],
  paperclip: ["M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"],
  wallet: ["M21 7H5a2 2 0 0 1-2-2a2 2 0 0 1 2-2h13v4", "M21 7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5", "M17 13.5h.01"],
  user: ["M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2", "M12 3a4 4 0 1 0 0 8a4 4 0 0 0 0-8z"],
  vehicle: ["M3 6h13v9H3z", "M16 9h3l2 3v3h-5V9z", "M6.5 16.5a2 2 0 1 0 0-4a2 2 0 0 0 0 4z", "M17 16.5a2 2 0 1 0 0-4a2 2 0 0 0 0 4z"],
  rider: ["M13 2 3 14h9l-1 8 10-12h-9l1-8z"],
};

export function NavIcon({
  name,
  className = "h-4 w-4",
  strokeWidth = 1.8,
}: {
  name: NavIconName;
  className?: string;
  strokeWidth?: number;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {PATHS[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

/** Correspondance chaîne (admin-nav) → icône. */
export const NAV_ICON_BY_KEY: Record<string, NavIconName> = {
  "📊": "chart",
  "📋": "list",
  "📅": "calendar",
  "🗂️": "folder",
  "🤝": "handshake",
  "👥": "users",
  "🏍️": "rider",
  "🏭": "box",
  "📦": "box",
  "📍": "pin",
  "📝": "list",
  "🚚": "truck",
  "🔌": "plug",
  "🧾": "receipt",
  "💬": "chat",
  "🔔": "bell",
  "✉️": "mail",
  "🎨": "palette",
  "⚙️": "settings",
};

export function NavGlyph({ glyph, className }: { glyph: string; className?: string }) {
  return <NavIcon name={NAV_ICON_BY_KEY[glyph] ?? "box"} className={className} />;
}
