import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import InternalMessages from "@/components/dashboard/InternalMessages";
import type { AppRole, Profile } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function MessagesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/dashboard/messages");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!profile) redirect("/dashboard");

  const role = profile.role as AppRole;

  // Chauffeurs et partenaires : interlocuteurs = staff (admin + dispatcher).
  // Staff : interlocuteurs = chauffeurs + le staff (entre eux).
  const targetRoles = role === "admin" || role === "dispatcher"
    ? ["admin", "dispatcher", "driver"]
    : ["admin", "dispatcher"];

  const { data: rows } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, avatar_url")
    .in("role", targetRoles)
    .neq("id", user.id)
    .order("role")
    .order("full_name");

  const counterparts = rows ?? [];

  return <InternalMessages counterparts={counterparts as Pick<Profile, "id" | "full_name" | "email" | "role" | "avatar_url">[]} />;
}
