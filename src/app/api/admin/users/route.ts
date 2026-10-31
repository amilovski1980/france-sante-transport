import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const ROLES = new Set(["client", "driver", "dispatcher", "admin", "partner"]);

/**
 * POST /api/admin/users — crée un compte complet (auth + profil) :
 * réservé à l'admin. L'e-mail est confirmé d'office (pas de flux
 * d'invitation à attendre) ; le mot de passe est fixé à la création.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Authentification requise" }, { status: 401 });
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (me?.role !== "admin") {
    return NextResponse.json({ ok: false, error: "Réservé à l'administrateur" }, { status: 403 });
  }

  let body: { email?: string; password?: string; full_name?: string; role?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Corps JSON invalide" }, { status: 400 });
  }

  const email = (body.email ?? "").trim().toLowerCase();
  const password = body.password ?? "";
  const fullName = (body.full_name ?? "").trim();
  const role = body.role ?? "client";

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ ok: false, error: "Adresse e-mail invalide" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ ok: false, error: "Mot de passe : 8 caractères minimum" }, { status: 400 });
  }
  if (fullName.length < 2) {
    return NextResponse.json({ ok: false, error: "Nom complet requis (2 caractères min.)" }, { status: 400 });
  }
  if (!ROLES.has(role)) {
    return NextResponse.json({ ok: false, error: "Rôle invalide" }, { status: 400 });
  }

  const admin = createAdminClient();
  let created: { id: string };
  try {
    const { data, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });
    if (createErr) {
      const dup = createErr.code === "422" || String(createErr.message).toLowerCase().includes("already");
      return NextResponse.json(
        { ok: false, error: dup ? "Un compte existe déjà avec cet e-mail." : createErr.message },
        { status: 400 },
      );
    }
    created = data.user;
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: "Clé service_role indisponible : " + (err instanceof Error ? err.message : "?") },
      { status: 500 },
    );
  }

  // Le trigger on_auth_user_created crée déjà le profil (rôle client) :
  // nom + rôle demandé via la RPC admin, exécutée avec la session admin
  // (les écritures directes en base déclencheraient la garde-fou anti-JWT).
  const { data: profile, error: profErr } = await supabase.rpc("admin_update_profile", {
    p_user_id: created.id,
    p_full_name: fullName,
    p_phone: null,
    p_address: null,
    p_avatar_url: null,
    p_role: role,
  });

  if (profErr || !profile) {
    return NextResponse.json(
      { ok: false, error: "Compte auth créé mais profil non configuré : " + (profErr?.message ?? "?") },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, profile });
}
