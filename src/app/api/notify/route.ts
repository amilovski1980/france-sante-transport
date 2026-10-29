import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email/send";
import {
  assignmentProposedEmail,
  quoteSentEmail,
  requestReceivedEmail,
} from "@/lib/email/templates";

export const dynamic = "force-dynamic";

type NotifyType = "quote_sent" | "assignment_proposed" | "request_received";

function badRequest(message: string): NextResponse {
  return NextResponse.json({ ok: false, error: message }, { status: 400 });
}

/**
 * Envoi des notifications e-mail transactionnelles.
 * Les données sont lues avec la session de l'utilisateur connecté : les
 * politiques RLS garantissent qu'on ne peut notifier que des dossiers
 * auxquels on a déjà accès (voire interdit l'accès → 404).
 */
export async function POST(request: Request): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Authentification requise" }, { status: 401 });
  }

  let body: { type?: NotifyType; id?: string };
  try {
    body = await request.json();
  } catch {
    return badRequest("Corps JSON invalide");
  }
  const { type, id } = body;
  if (!id || typeof id !== "string") return badRequest("Identifiant manquant");
  if (type !== "quote_sent" && type !== "assignment_proposed" && type !== "request_received") {
    return badRequest("Type de notification inconnu");
  }

  if (type === "request_received") {
    const { data: req } = await supabase
      .from("transport_requests")
      .select("id, pickup_address, dropoff_address, pickup_datetime, client_id")
      .eq("id", id)
      .single();
    if (!req) return NextResponse.json({ ok: false, error: "Demande introuvable" }, { status: 404 });

    const { data: profile } = await supabase
      .from("profiles")
      .select("email, full_name")
      .eq("id", req.client_id)
      .single();
    if (!profile) {
      return NextResponse.json({ ok: false, error: "Destinataire introuvable" }, { status: 404 });
    }

    const result = await sendEmail({
      to: profile.email,
      content: requestReceivedEmail({
        clientName: profile.full_name || profile.email,
        pickupAddress: req.pickup_address,
        dropoffAddress: req.dropoff_address,
        pickupDatetime: req.pickup_datetime,
      }),
    });
    return NextResponse.json(result, { status: result.ok ? 200 : 502 });
  }

  if (type === "quote_sent") {
    const { data: quote } = await supabase
      .from("quotes")
      .select("id, version, amount, currency, valid_until, status, transport_request_id")
      .eq("id", id)
      .single();
    if (!quote) return NextResponse.json({ ok: false, error: "Devis introuvable" }, { status: 404 });
    if (quote.status !== "sent") return badRequest("Le devis n'est pas au statut envoyé");

    const { data: req } = await supabase
      .from("transport_requests")
      .select("pickup_address, dropoff_address, client_id")
      .eq("id", quote.transport_request_id)
      .single();
    if (!req) return NextResponse.json({ ok: false, error: "Demande introuvable" }, { status: 404 });

    const { data: profile } = await supabase
      .from("profiles")
      .select("email, full_name")
      .eq("id", req.client_id)
      .single();
    if (!profile) {
      return NextResponse.json({ ok: false, error: "Destinataire introuvable" }, { status: 404 });
    }

    const result = await sendEmail({
      to: profile.email,
      content: quoteSentEmail({
        clientName: profile.full_name || profile.email,
        version: quote.version,
        amount: Number(quote.amount),
        currency: quote.currency,
        validUntil: quote.valid_until,
        pickupAddress: req.pickup_address,
        dropoffAddress: req.dropoff_address,
      }),
    });
    return NextResponse.json(result, { status: result.ok ? 200 : 502 });
  }

  // assignment_proposed
  const { data: assignment } = await supabase
    .from("driver_assignments")
    .select("id, status, shipment_id, driver_id, vehicle_id")
    .eq("id", id)
    .single();
  if (!assignment) {
    return NextResponse.json({ ok: false, error: "Affectation introuvable" }, { status: 404 });
  }
  if (assignment.status !== "proposed") return badRequest("L'affectation n'est plus une proposition");

  const { data: shipment } = await supabase
    .from("shipments")
    .select("scheduled_at, transport_request_id")
    .eq("id", assignment.shipment_id)
    .single();
  const { data: req } = shipment
    ? await supabase
        .from("transport_requests")
        .select("pickup_address, dropoff_address")
        .eq("id", shipment.transport_request_id)
        .single()
    : { data: null };
  const [{ data: driver }, { data: vehicle }] = await Promise.all([
    supabase.from("profiles").select("email, full_name").eq("id", assignment.driver_id).single(),
    supabase
      .from("vehicles")
      .select("registration_plate, label")
      .eq("id", assignment.vehicle_id)
      .single(),
  ]);
  if (!driver || !shipment || !req || !vehicle) {
    return NextResponse.json({ ok: false, error: "Données de mission incomplètes" }, { status: 404 });
  }

  const result = await sendEmail({
    to: driver.email,
    content: assignmentProposedEmail({
      driverName: driver.full_name || driver.email,
      scheduledAt: shipment.scheduled_at,
      pickupAddress: req.pickup_address,
      dropoffAddress: req.dropoff_address,
      vehicleLabel: vehicle.label,
      registrationPlate: vehicle.registration_plate,
    }),
  });
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
