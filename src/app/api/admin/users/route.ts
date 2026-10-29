import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send";
import { inviteUserEmail, passwordResetEmail } from "@/lib/email/templates";
import type { Profile } from "@/lib/types";

export const dynamic = "force-dynamic";

const ROLE_VALUES: Profile["role"][] = ["client", "driver", "dispatcher", "admin", "partner"];

interface AdminGuard {
  sessionUserId: string;
}

/** Vérifie côté serveur que l'appelant est bien un administrateur. */
async function requireAdmin(): Promise<{ guard: AdminGuard; error?: NextResponse }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      guard: { sessionUserId: "" },
      error: NextResponse.json(
        { ok: false, error: "Authentification requise" },
        { status: 401 },
      ),
    };
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") {
    return {
      guard: { sessionUserId: user.id },
      error: NextResponse.json(
        { ok: false, error: "Réservé aux administrateurs" },
        { status: 403 },
      ),
    };
  }
  return { guard: { sessionUserId: user.id } };
}

/** Empêche d'interdire ou de supprimer le dernier administrateur. */
async function isLastAdmin(targetUserId: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data: admins } = await admin
    .from("profiles")
    .select("id")
    .eq("role", "admin")
    .limit(10);
  if (!admins) return false;
  return admins.length <= 1 && admins.some((a) => a.id === targetUserId);
}

function resetUrl(): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";
  return `${base.replace(/\/$/, "")}/reset-password`;
}

// ------------------------------------------------------------
// GET /api/admin/users — état d'authentification des comptes (bannissement)
// ------------------------------------------------------------
export async function GET(): Promise<NextResponse> {
  const { error: guardError } = await requireAdmin();
  if (guardError) return guardError;

  const admin = createAdminClient();
  try {
    const { data, error } = await admin.auth.admin.listUsers({ perPage: 200 });
    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message ?? "Liste impossible" },
        { status: 502 },
      );
    }
    return NextResponse.json({
      ok: true,
      users: data.users.map((u) => ({ id: u.id, banned: Boolean(u.banned_until) })),
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Liste impossible" },
      { status: 502 },
    );
  }
}

// ------------------------------------------------------------
// POST /api/admin/users — créer / inviter un utilisateur
// body: { email, full_name, role }
// ------------------------------------------------------------
export async function POST(request: Request): Promise<NextResponse> {
  const { guard, error: guardError } = await requireAdmin();
  if (guardError) return guardError;
  void guard;

  let body: { email?: string; full_name?: string; role?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Corps JSON invalide" }, { status: 400 });
  }

  const email = (body.email ?? "").trim().toLowerCase();
  const fullName = (body.full_name ?? "").trim();
  const role = body.role ?? "client";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ ok: false, error: "Adresse e-mail invalide" }, { status: 400 });
  }
  if (!ROLE_VALUES.includes(role as Profile["role"])) {
    return NextResponse.json({ ok: false, error: "Rôle inconnu" }, { status: 400 });
  }
  if (fullName.length > 120) {
    return NextResponse.json({ ok: false, error: "Nom trop long" }, { status: 400 });
  }

  const admin = createAdminClient();
  let userId: string;
  try {
    const { data, error: createError } = await admin.auth.admin.createUser({
      email,
      // Mot de passe aléatoire jamais communiqué : l'utilisateur choisit
      // le sien via le lien d'activation envoyé ci-dessous.
      password: crypto.randomUUID(),
      email_confirm: true,
      user_metadata: { full_name: fullName || undefined },
    });
    if (createError || !data.user) {
      if (createError?.code === "email_exists") {
        return NextResponse.json(
          { ok: false, error: "Un compte existe déjà avec cet e-mail." },
          { status: 409 },
        );
      }
      return NextResponse.json(
        { ok: false, error: createError?.message ?? "Création impossible" },
        { status: 502 },
      );
    }
    userId = data.user.id;
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Création impossible" },
      { status: 502 },
    );
  }

  // Rôle via la RPC auditéée (le trigger interdit un UPDATE service_role,
  // les claims PostgREST service_role n'étant pas admin).
  const sessionClient = await createClient();
  const { error: roleError } = await sessionClient.rpc("set_user_role", {
    p_user_id: userId,
    p_role: role,
  });
  if (roleError) {
    // On nettoie : mieux vaut échec propre que un compte orphelin.
    await admin.auth.admin.deleteUser(userId).catch(() => undefined);
    return NextResponse.json(
      { ok: false, error: `Rôle non appliqué : ${String(roleError.message ?? roleError)}` },
      { status: 502 },
    );
  }

  if (fullName) {
    await admin.from("profiles").update({ full_name: fullName }).eq("id", userId);
  }

  // Lien d'activation envoyé par notre transport e-mail (jamais GoTrue SMTP).
  let emailSent = false;
  let provider = "console";
  try {
    const { data: link, error: linkError } = await admin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo: resetUrl() },
    });
    const actionLink = link?.properties?.action_link;
    if (!linkError && actionLink) {
      const result = await sendEmail({
        to: email,
        content: inviteUserEmail({ name: fullName || email, email, url: actionLink }),
      });
      emailSent = result.ok;
      provider = result.provider;
    }
  } catch {
    emailSent = false;
  }

  return NextResponse.json({ ok: true, user_id: userId, email_sent: emailSent, provider });
}

// ------------------------------------------------------------
// PATCH /api/admin/users — bannir / débannir / réinitialiser un mot de passe
// body: { user_id, action: "ban" | "unban" | "reset_password" }
// ------------------------------------------------------------
export async function PATCH(request: Request): Promise<NextResponse> {
  const { guard, error: guardError } = await requireAdmin();
  if (guardError) return guardError;

  let body: { user_id?: string; action?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Corps JSON invalide" }, { status: 400 });
  }

  const userId = body.user_id ?? "";
  const action = body.action ?? "";
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Identifiant manquant" }, { status: 400 });
  }
  if (action !== "ban" && action !== "unban" && action !== "reset_password") {
    return NextResponse.json({ ok: false, error: "Action inconnue" }, { status: 400 });
  }
  if (action === "ban" && userId === guard.sessionUserId) {
    return NextResponse.json(
      { ok: false, error: "Vous ne pouvez pas bannir votre propre compte." },
      { status: 400 },
    );
  }
  if (action === "ban" && (await isLastAdmin(userId))) {
    return NextResponse.json(
      { ok: false, error: "Impossible : ceci est le dernier compte administrateur." },
      { status: 409 },
    );
  }

  const admin = createAdminClient();

  if (action === "ban") {
    const { error: banError } = await admin.auth.admin.updateUserById(userId, {
      ban_duration: "87600h",
    });
    if (banError) {
      return NextResponse.json(
        { ok: false, error: banError.message ?? "Blocage impossible" },
        { status: 502 },
      );
    }
    return NextResponse.json({ ok: true });
  }

  if (action === "unban") {
    const { error: unbanError } = await admin.auth.admin.updateUserById(userId, {
      ban_duration: "none",
    });
    if (unbanError) {
      return NextResponse.json(
        { ok: false, error: unbanError.message ?? "Déblocage impossible" },
        { status: 502 },
      );
    }
    return NextResponse.json({ ok: true });
  }

  // reset_password : lien de réinitialisation envoyé par notre transport.
  const { data: profile } = await admin
    .from("profiles")
    .select("email, full_name")
    .eq("id", userId)
    .single();
  if (!profile?.email) {
    return NextResponse.json({ ok: false, error: "Compte introuvable" }, { status: 404 });
  }

  const { data: link, error: linkError } = await admin.auth.admin.generateLink({
    type: "recovery",
    email: profile.email,
    options: { redirectTo: resetUrl() },
  });
  const actionLink = link?.properties?.action_link;
  if (linkError || !actionLink) {
    return NextResponse.json(
      { ok: false, error: "Lien de réinitialisation impossible à générer" },
      { status: 502 },
    );
  }
  const result = await sendEmail({
    to: profile.email,
    content: passwordResetEmail({
      name: profile.full_name || profile.email,
      url: actionLink,
    }),
  });
  if (!result.ok && result.provider !== "console") {
    return NextResponse.json({ ok: false, error: "Envoi de l'e-mail impossible" }, { status: 502 });
  }
  return NextResponse.json({ ok: true, provider: result.provider });
}

// ------------------------------------------------------------
// DELETE /api/admin/users?user_id=… — supprimer un compte
// ------------------------------------------------------------
export async function DELETE(request: Request): Promise<NextResponse> {
  const { guard, error: guardError } = await requireAdmin();
  if (guardError) return guardError;

  const userId = new URL(request.url).searchParams.get("user_id") ?? "";
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Identifiant manquant" }, { status: 400 });
  }
  if (userId === guard.sessionUserId) {
    return NextResponse.json(
      { ok: false, error: "Vous ne pouvez pas supprimer votre propre compte." },
      { status: 400 },
    );
  }
  if (await isLastAdmin(userId)) {
    return NextResponse.json(
      { ok: false, error: "Impossible : ceci est le dernier compte administrateur." },
      { status: 409 },
    );
  }

  const admin = createAdminClient();
  const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
  if (deleteError) {
    return NextResponse.json(
      { ok: false, error: deleteError.message ?? "Suppression impossible" },
      { status: 502 },
    );
  }
  return NextResponse.json({ ok: true });
}
