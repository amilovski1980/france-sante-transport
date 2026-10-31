import { NextResponse } from "next/server";
import { createHash, randomInt } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email/send";
import { sendSms } from "@/lib/twilio/send";

export const dynamic = "force-dynamic";

const CODE_TTL_MIN = 10;
const MAX_ATTEMPTS = 5;

function hashCode(userId: string, channel: string, code: string): string {
  const salt = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "fst-local";
  return createHash("sha256").update(`${salt}|${userId}|${channel}|${code}`).digest("hex");
}

const digits = (n: number) => randomInt(0, 10 ** n).toString().padStart(n, "0");

export async function POST(request: Request): Promise<NextResponse> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Authentification requise" }, { status: 401 });

  let body: { channel?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Corps JSON invalide" }, { status: 400 });
  }
  const channel = body.channel;
  if (channel !== "email" && channel !== "sms") {
    return NextResponse.json({ ok: false, error: "Canal attendu : email ou sms" }, { status: 400 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("email, full_name, phone, email_verified_at, phone_verified_at")
    .eq("id", user.id)
    .single();
  if (!profile) return NextResponse.json({ ok: false, error: "Profil introuvable" }, { status: 404 });

  // Déjà vérifié ? Idempotent.
  if (channel === "email" && profile.email_verified_at) {
    return NextResponse.json({ ok: true, already: true });
  }
  if (channel === "sms" && profile.phone_verified_at) {
    return NextResponse.json({ ok: true, already: true });
  }

  // Anti-spam : pas plus d'une demande toutes les 45 s.
  const { data: recent } = await supabase
    .from("verification_codes")
    .select("created_at")
    .eq("user_id", user.id)
    .eq("channel", channel)
    .order("created_at", { ascending: false })
    .limit(1);
  if (recent?.[0] && Date.now() - new Date(recent[0].created_at).getTime() < 45_000) {
    return NextResponse.json({ ok: false, error: "Patientez un instant avant de redemander un code." }, { status: 429 });
  }

  const code = digits(6);
  const expiresAt = new Date(Date.now() + CODE_TTL_MIN * 60_000).toISOString();

  // Invalide tout code non consommé précédent sur ce canal.
  await supabase
    .from("verification_codes")
    .update({ consumed_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .eq("channel", channel)
    .is("consumed_at", null);

  const { error: insertErr } = await supabase.from("verification_codes").insert({
    user_id: user.id,
    channel,
    code_hash: hashCode(user.id, channel, code),
    expires_at: expiresAt,
  });
  if (insertErr) {
    return NextResponse.json({ ok: false, error: "Enregistrement du code impossible : " + insertErr.message }, { status: 500 });
  }

  if (channel === "email") {
    const result = await sendEmail({
      to: profile.email,
      content: {
        subject: "Votre code de validation — France Santé Transport",
        html: `<p style="font-size:15px;">Votre code de vérification :</p>
<div style="font-size:28px;font-weight:bold;letter-spacing:8px;margin:12px 0;color:#0a1f44;">${code}</div>
<p style="font-size:13px;color:#6b7a90;">Valide ${CODE_TTL_MIN} minutes. Ne le partagez pas.</p>`,
        text: `Votre code de vérification : ${code} (valide ${CODE_TTL_MIN} minutes).`,
      },
    });
    return NextResponse.json({
      ok: result.ok,
      provider: result.provider,
      detail: result.provider === "console" ? "SMTP non configuré : le code est affiché dans les journaux serveur." : undefined,
      error: result.error,
      expires_at: expiresAt,
    });
  }

  // SMS
  const phone = profile.phone?.replace(/\s/g, "");
  if (!phone) return NextResponse.json({ ok: false, error: "Ajoutez d'abord un numéro de téléphone." }, { status: 400 });
  const to = phone.startsWith("+") ? phone : `+33${phone.replace(/^0/, "")}`;
  const result = await sendSms({ to, body: `France Santé Transport — code de vérification : ${code} (valide ${CODE_TTL_MIN} min)` });
  return NextResponse.json({
    ok: result.ok,
    provider: result.provider,
    error: result.error,
    expires_at: expiresAt,
  });
}

export async function PUT(request: Request): Promise<NextResponse> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Authentification requise" }, { status: 401 });

  let body: { channel?: string; code?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Corps JSON invalide" }, { status: 400 });
  }
  const channel = body.channel;
  const code = (body.code ?? "").replace(/\D/g, "");
  if ((channel !== "email" && channel !== "sms") || code.length !== 6) {
    return NextResponse.json({ ok: false, error: "Code à 6 chiffres requis" }, { status: 400 });
  }

  const { data: rows } = await supabase
    .from("verification_codes")
    .select("id, code_hash, expires_at, attempts, consumed_at")
    .eq("user_id", user.id)
    .eq("channel", channel)
    .order("created_at", { ascending: false })
    .limit(1);
  const pending = rows?.[0];
  if (!pending || pending.consumed_at) {
    return NextResponse.json({ ok: false, error: "Aucun code en attente — demandez-en un nouveau." }, { status: 400 });
  }
  if (pending.attempts >= MAX_ATTEMPTS) {
    await supabase.from("verification_codes").update({ consumed_at: new Date().toISOString() }).eq("id", pending.id);
    return NextResponse.json({ ok: false, error: "Trop de tentatives — demandez un nouveau code." }, { status: 429 });
  }

  const valid =
    pending.code_hash === hashCode(user.id, channel, code) &&
    new Date(pending.expires_at).getTime() > Date.now();

  if (!valid) {
    await supabase.from("verification_codes").update({ attempts: pending.attempts + 1 }).eq("id", pending.id);
    return NextResponse.json({ ok: false, error: "Code invalide ou expiré." }, { status: 400 });
  }

  await supabase.from("verification_codes").update({ consumed_at: new Date().toISOString(), attempts: pending.attempts + 1 }).eq("id", pending.id);

  const stamp = new Date().toISOString();
  const { error: updErr } = await supabase
    .from("profiles")
    .update(channel === "email" ? { email_verified_at: stamp } : { phone_verified_at: stamp })
    .eq("id", user.id);
  if (updErr) {
    return NextResponse.json({ ok: false, error: "Mise à jour du profil impossible : " + updErr.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, verified: channel });
}
