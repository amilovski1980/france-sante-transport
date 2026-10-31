import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email/send";
import { sendSms } from "@/lib/twilio/send";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/settings/test — auto-test des services avec les réglages
 * actuels : e-mail envoyé à l'adresse de l'admin, SMS à son numéro de profil.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Authentification requise" }, { status: 401 });
  const { data: me } = await supabase.from("profiles").select("role, email, phone").eq("id", user.id).single();
  if (me?.role !== "admin") {
    return NextResponse.json({ ok: false, error: "Réservé aux administrateurs" }, { status: 403 });
  }

  let body: { service?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Corps JSON invalide" }, { status: 400 });
  }

  if (body.service === "email") {
    const result = await sendEmail({
      to: me.email,
      content: {
        subject: "Test des services France Santé Transport",
        html: `<p style="font-family:sans-serif;font-size:15px;color:#1f2937;">E-mail de test envoyé à ${new Date().toLocaleTimeString("fr-FR")} avec le « service e-mail » actuel.</p>`,
        text: "Test des services France Santé Transport.",
      },
    });
    return NextResponse.json({ ok: result.ok, detail: result.provider === "console" ? "Aucun SMTP / Resend configuré : contenu imprimé dans les journaux serveur." : `Fournisseur actif : ${result.provider}`, provider: result.provider, error: result.error });
  }

  if (body.service === "sms") {
    const phone = me.phone?.replace(/\s/g, "");
    if (!phone) {
      return NextResponse.json({ ok: false, error: "Enregistrez d'abord un numéro de téléphone sur votre Profil." }, { status: 400 });
    }
    const to = phone.startsWith("+") ? phone : `+33${phone.replace(/^0/, "")}`;
    const result = await sendSms({ to, body: `Test SMS France Santé Transport — ${new Date().toLocaleTimeString("fr-FR")}` });
    return NextResponse.json({ ok: result.ok, detail: result.provider === "none" ? "Twilio non configuré." : "Twilio", error: result.error });
  }

  return NextResponse.json({ ok: false, error: "Service inconnu (attendu : email | sms)" }, { status: 400 });
}
