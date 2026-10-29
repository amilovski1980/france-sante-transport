import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SignOutButton from "@/components/SignOutButton"; import Avatar from "@/components/Avatar"; import DashboardSidebar from "@/components/dashboard/DashboardSidebar";
import BottomNav from "@/components/dashboard/BottomNav";
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
      <div className="dash-bg min-h-screen"><div className="mx-auto max-w-2xl"><div className="flex items-center justify-between border-b border-navy-100 bg-white px-4 py-3 dark:border-white/10 dark:bg-[#0f131b]"><div className="flex items-center gap-2"><Avatar name={profile.full_name} email={profile.email} src={(profile as { avatar_url?: string | null }).avatar_url} size="sm" /><span className="text-sm font-semibold text-navy-900 dark:text-slate-100">{profile.full_name || profile.email}</span></div><SignOutButton /></div><div className="px-4 pb-24 pt-6">{children}</div></div><BottomNav /></div>
    </section>
  );
}
