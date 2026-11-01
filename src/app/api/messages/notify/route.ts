import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAudience, notifyUsers } from "@/lib/notifications";

/**
 * Notification in-app + web push de la réception d'un message interne.
 * Le message est inséré côté client (RLS) ; le destinataire doit être
 * prévenu même si son onglet est fermé (push) ou sur un autre fil.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Authentification requise" }, { status: 401 });
  }

  let body: { message_id?: string } = {};
  try {
    body = (await request.json()) as { message_id?: string };
  } catch {
    body = {};
  }
  const messageId = typeof body.message_id === "string" ? body.message_id : "";
  if (!/^[0-9a-f-]{36}$/i.test(messageId)) {
    return NextResponse.json({ ok: false, error: "Identifiant de message invalide" }, { status: 400 });
  }

  try {
    const admin = createAdminClient();
    const { data: message } = await admin
      .from("internal_messages")
      .select("id, sender_id, recipient_id, body")
      .eq("id", messageId)
      .single();

    if (!message) {
      return NextResponse.json({ ok: false, error: "Message introuvable" }, { status: 404 });
    }
    if (message.sender_id !== user.id) {
      return NextResponse.json({ ok: false, error: "Accès refusé" }, { status: 403 });
    }

    const recipient = await getAudience(message.recipient_id);
    if (!recipient) {
      return NextResponse.json({ ok: false, error: "Destinataire introuvable" }, { status: 404 });
    }

    const preview = String(message.body ?? "").slice(0, 120);
    await notifyUsers([recipient], {
      type: "internal_message",
      title: "Nouveau message",
      body: preview,
      url: "/dashboard/messages",
      tag: `internal_message:${message.id}`,
      data: { sender_id: user.id },
    });
    return NextResponse.json({ ok: true, notified: 1 }, { status: 200 });
  } catch {
    return NextResponse.json({ ok: false, error: "Notification indisponible" }, { status: 503 });
  }
}
