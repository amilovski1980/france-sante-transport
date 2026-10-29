import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SignOutButton from "@/components/SignOutButton"; import Avatar from "@/components/Avatar"; import DashboardSidebar from "@/components/dashboard/DashboardSidebar";
import type { Profile } from "@/lib/types";

const ROLE_LABELS: Record<Profile["role"], { label: string; hint: string }> = {
  client: { label: "Espace client", hint: "Vos demandes, devis et missions" },
  admin: { label: "Console d'administration", hint: "Pilotage complet des dossiers" },
  dispatcher: { label: "Espace exploitation", hint: "Instruction des demandes et missions" },
  driver: { label: "Espace chauffeur", hint: "Vos affectations de mission" },
  partner: { label: "Espace partenaire", hint: "Vos dossiers partenaires" },
};

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirect=/dashboard");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, created_at, updated_at, phone, avatar_url, address")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return (
      <section className="section-pad bg-navy-50/60">
        <div className="container-x">
          <div className="surface mx-auto max-w-lg p-8 text-center">
            <h1 className="font-display text-2xl font-semibold text-navy-900">
              Profil en cours de création
            </h1>
            <p className="mt-3 text-sm text-navy-700/80">
              Votre profil n&apos;est pas encore initialisé. Reconnectez-vous dans quelques instants.
            </p>
          </div>
        </div>
      </section>
    );
  }

  const roleInfo = ROLE_LABELS[profile.role as Profile["role"]];

  return (
    <section>
      <div className="bg-navy-900 text-white print:hidden">
        <div className="container-x flex flex-col gap-6 py-10 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-flagred-500">
              {roleInfo.label}
            </p>
            <h1 className="mt-2 font-display text-3xl font-semibold sm:text-4xl">
              {profile.full_name || profile.email}
            </h1>
            <p className="mt-2 text-sm text-navy-100/80">
              {roleInfo.hint} · {profile.email}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Avatar name={profile.full_name} email={profile.email} src={(profile as { avatar_url?: string | null }).avatar_url} size="md" className="ring-white/40" /><span className="rounded-full border border-white/25 bg-white/5 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider">
              Rôle : {profile.role}
            </span>
            <SignOutButton />
          </div>
        </div>
      </div>
      <div className="dash-bg flex min-h-[calc(100vh-5rem)]"><DashboardSidebar profile={profile as Profile} /><div className="flex-1 py-8"><div className="container-x">{children}</div></div></div>
    </section>
  );
}
