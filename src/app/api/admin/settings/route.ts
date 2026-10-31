import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { invalidateAppSettingsCache, loadAppSettings, maskSecret } from "@/lib/app-settings";

export const dynamic = "force-dynamic";

const FIELDS = [
  "smtp_host",
  "smtp_port",
  "smtp_user",
  "smtp_pass",
  "smtp_from",
  "resend_api_key",
  "twilio_account_sid",
  "twilio_auth_token",
  "twilio_from",
  "stripe_secret_key",
  "vat_rate",
  "docusign_account_id",
  "docusign_integration_key",
  "docusign_user_id",
  "docusign_private_key",
  "docusign_environment",
] as const;

function isEmail(value: unknown): boolean {
  return typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

async function requireAdmin(): Promise<{ ok: true } | { ok: false; res: NextResponse }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, res: NextResponse.json({ ok: false, error: "Authentification requise" }, { status: 401 }) };
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (me?.role !== "admin") {
    return { ok: false, res: NextResponse.json({ ok: false, error: "Réservé aux administrateurs" }, { status: 403 }) };
  }
  return { ok: true };
}

export async function GET(): Promise<NextResponse> {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.res;
  const s = await loadAppSettings();
  return NextResponse.json({
    ok: true,
    settings: {
      smtp_host: s.smtp_host,
      smtp_port: s.smtp_port,
      smtp_user: s.smtp_user,
      smtp_pass: maskSecret(s.smtp_pass),
      smtp_from: s.smtp_from,
      resend_api_key: maskSecret(s.resend_api_key),
      twilio_account_sid: maskSecret(s.twilio_account_sid),
      twilio_auth_token: maskSecret(s.twilio_auth_token),
      twilio_from: s.twilio_from,
      stripe_secret_key: maskSecret(s.stripe_secret_key),
      vat_rate: s.vat_rate ?? 0,
      docusign_account_id: s.docusign_account_id,
      docusign_integration_key: maskSecret(s.docusign_integration_key),
      docusign_user_id: s.docusign_user_id,
      docusign_private_key: maskSecret(s.docusign_private_key),
      docusign_environment: s.docusign_environment ?? "demo",
      configured: {
        email: Boolean(s.resend_api_key || (s.smtp_host && s.smtp_port)),
        sms: Boolean(s.twilio_account_sid && s.twilio_auth_token && s.twilio_from),
        stripe: Boolean(s.stripe_secret_key),
        docusign: Boolean(
          s.docusign_account_id && s.docusign_integration_key && s.docusign_user_id && s.docusign_private_key,
        ),
      },
    },
    masks: {
      smtp_pass: Boolean(s.smtp_pass),
      resend_api_key: Boolean(s.resend_api_key),
      twilio_account_sid: Boolean(s.twilio_account_sid),
      twilio_auth_token: Boolean(s.twilio_auth_token),
      stripe_secret_key: Boolean(s.stripe_secret_key),
      docusign_integration_key: Boolean(s.docusign_integration_key),
      docusign_private_key: Boolean(s.docusign_private_key),
    },
  });
}

/**
 * Upsert des réglages. Un champposté vide + mask actif = inchangé ; champposté vide
 * sans mask existant = effacement d'office.
 */
export async function PUT(request: Request): Promise<NextResponse> {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.res;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Corps JSON invalide" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const current = await loadAppSettings();
  const masks = {
    smtp_pass: Boolean(current.smtp_pass),
    resend_api_key: Boolean(current.resend_api_key),
    twilio_account_sid: Boolean(current.twilio_account_sid),
    twilio_auth_token: Boolean(current.twilio_auth_token),
    stripe_secret_key: Boolean(current.stripe_secret_key),
    docusign_integration_key: Boolean(current.docusign_integration_key),
    docusign_private_key: Boolean(current.docusign_private_key),
  };

  const patch: Record<string, string | number | null> = { updated_at: new Date().toISOString() };
  if (user) patch.updated_by = user.id;
  for (const f of FIELDS) {
    if (!(f in body)) continue;
    const raw = body[f];
    let value: string | number | null = null;
    if (typeof raw === "string" && raw.trim() !== "") value = raw.trim();
    if (f === "smtp_port" && value !== null) {
      const port = Number(value);
      if (!Number.isInteger(port) || port < 1 || port > 65535) {
        return NextResponse.json({ ok: false, error: "Port SMTP invalide (1-65535)" }, { status: 400 });
      }
      value = port;
    }
    if (f === "vat_rate" && value !== null) {
      const vat = Number(String(value).replace(",", "."));
      if (!Number.isFinite(vat) || vat < 0 || vat > 30) {
        return NextResponse.json({ ok: false, error: "TVA invalide (0-30 %)" }, { status: 400 });
      }
      value = vat;
    }
    if (f === "docusign_environment" && value !== null && value !== "demo" && value !== "production") {
      return NextResponse.json({ ok: false, error: "Environnement DocuSign invalide (demo ou production)" }, { status: 400 });
    }
    // Un masque avec valeur vide signifie « inchangé » pour les secrets.
    if (value === null && f in masks && masks[f as keyof typeof masks]) continue;
    if (value !== null && (f === "smtp_from" || f === "twilio_from")) {
      if (!isEmail((value as string).replace(/^\s*\".*?\"\s*/, "").replace(/<|>/g, ""))) {
        if (f === "twilio_from") {
          // Tail de numéro acceptée pour Twilio From.
          if (!/^(\+[1-9]\d{1,14}|[a-z0-9]+)([a-z0-9]*)*$/i.test(value as string)) {
            return NextResponse.json({ ok: false, error: "Twilio From invalide (numéro +E.164 ou alphanumérique)." }, { status: 400 });
          }
          void value;
        }
      }
    }
    patch[f] = value;
  }

  const { error: err } = await supabase
    .from("app_settings")
    .update(patch)
    .eq("id", 1);

  if (err) {
    const message = err.code === "42501"
      ? "Seuls les administrateurs peuvent modifier ces réglages."
      : "Enregistrement impossible : " + err.message;
    return NextResponse.json({ ok: false, error: message }, { status: err.code === "42501" ? 403 : 500 });
  }
  invalidateAppSettingsCache();
  return NextResponse.json({ ok: true });
}
