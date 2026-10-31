import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendWebPush } from "@/lib/webpush/send";

export const dynamic = "force-dynamic";

/**
 * POST /api/partner/referrals — le partenaire transmet un dossier
 * (apport d'affaires) : contact client + besoin. Le statut démarre à
 * « instruit non » (handled=false) et le staff est notifié (push).
 */
export async function POST(request: Request): Promise<NextResponse> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Authentification requise" }, { status: 401 });

  const { data: me } = await supabase.from("profiles").select("role, email, full_name").eq("id", user.id).single();
  if (!me) return NextResponse.json({ ok: false, error: "Profil introuvable" }, { status: 404 });
  if (me.role !== "partner" && me.role !== "admin" && me.role !== "dispatcher") {
    return NextResponse.json({ ok: false, error: "Réservé aux partenaires et au staff" }, { status: 403 });
  }

  let body: {
    contact_name?: string;
    contact_email?: string;
    contact_phone?: string;
    organization?: string;
    need?: string;
    pickup?: string;
    dropoff?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Corps JSON invalide" }, { status: 400 });
  }

  const contactName = (body.contact_name ?? "").trim();
  const email = (body.contact_email ?? me.email ?? "").trim();
  const need = (body.need ?? "").trim();
  if (contactName.length < 2 || email.length < 5 || need.length < 10) {
    return NextResponse.json(
      { ok: false, error: "Nom du contact, e-mail et besoin (10 caractères min.) sont requis" },
      { status: 400 },
    );
  }

  const pieces = [
    body.organization?.trim() ? `Structure : ${body.organization.trim()}` : "",
    body.pickup?.trim() ? `Départ : ${body.pickup.trim()}` : "",
    body.dropoff?.trim() ? `Arrivée : ${body.dropoff.trim()}` : "",
    `Besoin : ${need}`,
  ].filter(Boolean);

  const origin = me.role === "partner" ? user.id : null;
  const { data: inserted, error: insertErr } = await supabase
    .from("contact_messages")
    .insert({
      topic: "referral",
      full_name: contactName,
      email,
      phone: (body.contact_phone ?? "").trim() || null,
      subject: `Apport d'affaires — ${contactName}${body.organization?.trim() ? ` (${body.organization.trim()})` : ""}`,
      message: pieces.join("\n"),
      partner_id: origin,
    })
    .select("id")
    .single();

  if (insertErr || !inserted) {
    return NextResponse.json({ ok: false, error: "Enregistrement impossible : " + (insertErr?.message ?? "?") }, { status: 500 });
  }

  // Notification push au staff (admin + dispatchers)
  if (me.role === "partner") {
    try {
      const { data: staff } = await supabase
        .from("profiles")
        .select("id")
        .in("role", ["admin", "dispatcher"]);
      for (const s of staff ?? []) {
        void sendWebPush(s.id, {
          title: "Nouvel apport d'affaires 🤝",
          body: `${me.full_name || me.email} → ${contactName} : ${need.slice(0, 80)}`,
          url: "/dashboard/partners",
          tag: `referral-${inserted.id}`,
        });
      }
    } catch {
      /* push Best Effort */
    }
  }

  return NextResponse.json({ ok: true, id: inserted.id });
}
