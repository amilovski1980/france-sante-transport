"use client";

/**
 * Conteneur de panneau premium : en-tete avec titre, icone optionnelle et
 * action a droite, corps avec padding. Style aligne sur la maquette
 * (carte blanche, bord arrondi, ombre douce, titre gris ardoise).
 */
export default function PanelCard({
  title,
  subtitle,
  icon,
  action,
  children,
  className = "",
  bodyClassName = "p-5",
}: {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={`flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm ${className}`}>
      <header className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          {icon && <span className="text-slate-400">{icon}</span>}
          <div>
            <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
            {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
          </div>
        </div>
        {action}
      </header>
      <div className={`flex-1 ${bodyClassName}`}>{children}</div>
    </section>
  );
}
