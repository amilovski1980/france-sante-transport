import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  alertEmail,
  assignmentProposedEmail,
  invoiceSentEmail,
  quoteSentEmail,
  requestReceivedEmail,
} from "@/lib/email/templates";
import {
  getAudience,
  getDriverAudience,
  listAudienceByRoles,
  notifyUsers,
} from "@/lib/notifications";

export const dynamic = "force-dynamic";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const STAFF_ROLES = ["admin", "dispatcher"];

type NotifyType =
  | "request_received"
  | "request_under_review"
  | "request_cancelled"
  | "quote_sent"
  | "quote_accepted"
  | "quote_declined"
  | "assignment_proposed"
  | "assignment_response"
  | "shipment_confirmed"
  | "shipment_started"
  | "shipment_completed"
  | "shipment_cancelled"
  | "delivery_proved"
  | "invoice_sent";

const NOTIFY_TYPES: NotifyType[] = [
  "request_received",
  "request_under_review",
  "request_cancelled",
  "quote_sent",
  "quote_accepted",
  "quote_declined",
  "assignment_proposed",
  "assignment_response",
  "shipment_confirmed",
  "shipment_started",
  "shipment_completed",
  "shipment_cancelled",
  "delivery_proved",
  "invoice_sent",
];

function money(amount: number, currency: string): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency }).format(amount);
}

function formatDate(value: string | null): string {
  if (!value) return "à définir";
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeStyle: "short" }).format(
    new Date(value),
  );
}

function badRequest(message: string): NextResponse {
  return NextResponse.json({ ok: false, error: message }, { status: 400 });
}

function notFound(message: string): NextResponse {
  return NextResponse.json({ ok: false, error: message }, { status: 404 });
}

function done(): NextResponse {
  return NextResponse.json({ ok: true });
}

function routeLabel(pickup: string, dropoff: string): string {
  return `${pickup} → ${dropoff}`;
}

/**
 * Notifications transactionnelles à chaque étape du dossier.
 * Les données cibles sont lues avec la session de l'utilisateur connecté
 * (RLS), puis les destinataires et notifications in-app sont gérés côté
 * serveur avec la clé service_role.
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
  if (!type || !NOTIFY_TYPES.includes(type)) return badRequest("Type de notification inconnu");

  if (type === "request_received") {
    const { data: req } = await supabase
      .from("transport_requests")
      .select("id, pickup_address, dropoff_address, pickup_datetime, client_id")
      .eq("id", id)
      .single();
    if (!req) return notFound("Demande introuvable");

    const [client, staff] = await Promise.all([
      getAudience(req.client_id),
      listAudienceByRoles(STAFF_ROLES),
    ]);
    const route = routeLabel(req.pickup_address, req.dropoff_address);
    const clientName = client?.full_name || client?.email || "Client";

    await notifyUsers(
      staff,
      {
        type,
        title: "Nouvelle demande de devis",
        body: `${clientName} · ${route}`,
        url: "/dashboard/requests",
        tag: `request-${req.id}-staff`,
        data: { request_id: req.id },
      },
      {
        email: () =>
          alertEmail({
            subject: "Nouvelle demande de transport",
            title: "Nouvelle demande de devis",
            intro: "Une nouvelle demande de transport vient d'être déposée.",
            lines: [
              `Client : ${clientName}`,
              `Trajet : ${route}`,
              `Horaire souhaité : ${formatDate(req.pickup_datetime)}`,
            ],
            actionLabel: "Ouvrir les dossiers",
            actionUrl: `${APP_URL}/dashboard/requests`,
          }),
      },
    );

    if (client) {
      await notifyUsers(
        [client],
        {
          type: "request_received_ack",
          title: "Demande enregistrée",
          body: `${route} : nos équipes l'instruisent.`,
          url: "/dashboard/requests",
          tag: `request-${req.id}-ack`,
          data: { request_id: req.id },
        },
        {
          email: (audience) =>
            requestReceivedEmail({
              clientName: audience.full_name || audience.email,
              pickupAddress: req.pickup_address,
              dropoffAddress: req.dropoff_address,
              pickupDatetime: req.pickup_datetime,
            }),
        },
      );
    }
    return done();
  }

  if (type === "request_under_review") {
    const { data: req } = await supabase
      .from("transport_requests")
      .select("id, pickup_address, dropoff_address, client_id")
      .eq("id", id)
      .single();
    if (!req) return notFound("Demande introuvable");

    const client = await getAudience(req.client_id);
    if (!client) return notFound("Destinataire introuvable");
    const route = routeLabel(req.pickup_address, req.dropoff_address);
    await notifyUsers(
      [client],
      {
        type,
        title: "Demande en cours d'instruction",
        body: `${route} : notre équipe prépare votre devis.`,
        url: "/dashboard/requests",
        tag: `request-${req.id}-review`,
        data: { request_id: req.id },
      },
      {
        email: (audience) =>
          alertEmail({
            subject: "Votre demande est en cours d'instruction",
            title: "Demande en cours d'instruction",
            intro: `Bonjour ${audience.full_name || audience.email}, notre équipe étudie votre demande.`,
            lines: [`Trajet : ${route}`],
            actionLabel: "Suivre ma demande",
            actionUrl: `${APP_URL}/dashboard/requests`,
          }),
      },
    );
    return done();
  }

  if (type === "request_cancelled") {
    const { data: req } = await supabase
      .from("transport_requests")
      .select("id, pickup_address, dropoff_address, client_id")
      .eq("id", id)
      .single();
    if (!req) return notFound("Demande introuvable");

    const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    const cancelledByClient = me?.role === "client" || req.client_id === user.id;
    const route = routeLabel(req.pickup_address, req.dropoff_address);

    if (cancelledByClient) {
      const [client, staff] = await Promise.all([
        getAudience(req.client_id),
        listAudienceByRoles(STAFF_ROLES),
      ]);
      await notifyUsers(staff, {
        type,
        title: "Demande annulée par le client",
        body: `${client?.full_name || client?.email || "Client"} · ${route}`,
        url: "/dashboard/requests",
        tag: `request-${req.id}-cancelled-staff`,
        data: { request_id: req.id },
      });
    } else {
      const client = await getAudience(req.client_id);
      if (client) {
        await notifyUsers(
          [client],
          {
            type,
            title: "Votre demande a été annulée",
            body: `${route} : contactez-nous pour toute question.`,
            url: "/dashboard/requests",
            tag: `request-${req.id}-cancelled-client`,
            data: { request_id: req.id },
          },
          {
            email: (audience) =>
              alertEmail({
                subject: "Votre demande a été annulée",
                title: "Demande annulée",
                intro: `Bonjour ${audience.full_name || audience.email}, votre demande de transport a été annulée.`,
                lines: [`Trajet : ${route}`],
                actionLabel: "Ouvrir mon espace",
                actionUrl: `${APP_URL}/dashboard/requests`,
              }),
          },
        );
      }
    }
    return done();
  }

  if (type === "quote_sent") {
    const { data: quote } = await supabase
      .from("quotes")
      .select("id, version, amount, currency, valid_until, status, transport_request_id")
      .eq("id", id)
      .single();
    if (!quote) return notFound("Devis introuvable");
    if (quote.status !== "sent") return badRequest("Le devis n'est pas au statut envoyé");

    const { data: req } = await supabase
      .from("transport_requests")
      .select("pickup_address, dropoff_address, client_id")
      .eq("id", quote.transport_request_id)
      .single();
    if (!req) return notFound("Demande introuvable");

    const client = await getAudience(req.client_id);
    if (!client) return notFound("Destinataire introuvable");
    const route = routeLabel(req.pickup_address, req.dropoff_address);

    await notifyUsers(
      [client],
      {
        type,
        title: "Nouveau devis disponible",
        body: `v${quote.version} · ${money(Number(quote.amount), quote.currency)} · ${route}`,
        url: "/dashboard/requests",
        tag: `quote-${quote.id}-v${quote.version}`,
        data: { quote_id: quote.id, request_id: quote.transport_request_id },
      },
      {
        email: (audience) =>
          quoteSentEmail({
            clientName: audience.full_name || audience.email,
            version: quote.version,
            amount: Number(quote.amount),
            currency: quote.currency,
            validUntil: quote.valid_until,
            pickupAddress: req.pickup_address,
            dropoffAddress: req.dropoff_address,
          }),
      },
    );
    return done();
  }

  if (type === "quote_accepted" || type === "quote_declined") {
    const { data: quote } = await supabase
      .from("quotes")
      .select("id, version, amount, currency, transport_request_id")
      .eq("id", id)
      .single();
    if (!quote) return notFound("Devis introuvable");

    const { data: req } = await supabase
      .from("transport_requests")
      .select("pickup_address, dropoff_address, client_id")
      .eq("id", quote.transport_request_id)
      .single();
    if (!req) return notFound("Demande introuvable");

    const [client, staff] = await Promise.all([
      getAudience(req.client_id),
      listAudienceByRoles(STAFF_ROLES),
    ]);
    const accepted = type === "quote_accepted";
    const route = routeLabel(req.pickup_address, req.dropoff_address);
    const amount = money(Number(quote.amount), quote.currency);
    const clientName = client?.full_name || client?.email || "Le client";

    await notifyUsers(
      staff,
      {
        type,
        title: accepted ? "Devis accepté par le client" : "Devis refusé par le client",
        body: `${clientName} · ${amount} · ${route}`,
        url: "/dashboard/requests",
        tag: `quote-${quote.id}-${accepted ? "accepted" : "declined"}`,
        data: { quote_id: quote.id, request_id: quote.transport_request_id },
      },
      {
        email: () =>
          alertEmail({
            subject: accepted ? "Devis accepté par le client" : "Devis refusé par le client",
            title: accepted ? "Devis accepté" : "Devis refusé",
            intro: `${clientName} a ${accepted ? "accepté" : "refusé"} le devis version ${quote.version}.`,
            lines: [`Montant : ${amount}`, `Trajet : ${route}`],
            actionLabel: "Ouvrir le dossier",
            actionUrl: `${APP_URL}/dashboard/requests`,
          }),
      },
    );
    return done();
  }

  if (type === "assignment_proposed") {
    const { data: assignment } = await supabase
      .from("driver_assignments")
      .select("id, status, shipment_id, driver_id, vehicle_id")
      .eq("id", id)
      .single();
    if (!assignment) return notFound("Affectation introuvable");
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
    const [{ data: vehicle }, driver] = await Promise.all([
      supabase
        .from("vehicles")
        .select("registration_plate, label")
        .eq("id", assignment.vehicle_id)
        .single(),
      getAudience(assignment.driver_id),
    ]);
    if (!driver || !shipment || !req || !vehicle) {
      return notFound("Données de mission incomplètes");
    }
    const route = routeLabel(req.pickup_address, req.dropoff_address);

    await notifyUsers(
      [driver],
      {
        type,
        title: "Nouvelle mission proposée",
        body: `${formatDate(shipment.scheduled_at)} · ${route}`,
        url: "/dashboard",
        tag: `assignment-${assignment.id}`,
        data: { assignment_id: assignment.id, shipment_id: assignment.shipment_id },
      },
      {
        email: (audience) =>
          assignmentProposedEmail({
            driverName: audience.full_name || audience.email,
            scheduledAt: shipment.scheduled_at,
            pickupAddress: req.pickup_address,
            dropoffAddress: req.dropoff_address,
            vehicleLabel: vehicle.label,
            registrationPlate: vehicle.registration_plate,
          }),
      },
    );
    return done();
  }

  if (type === "assignment_response") {
    const { data: assignment } = await supabase
      .from("driver_assignments")
      .select("id, status, shipment_id, driver_id")
      .eq("id", id)
      .single();
    if (!assignment) return notFound("Affectation introuvable");
    const accepted = assignment.status === "accepted";
    const declined = assignment.status === "declined";
    if (!accepted && !declined) return badRequest("Aucune réponse du chauffeur");

    const { data: shipment } = await supabase
      .from("shipments")
      .select("scheduled_at, transport_request_id")
      .eq("id", assignment.shipment_id)
      .single();
    const { data: req } = shipment
      ? await supabase
          .from("transport_requests")
          .select("pickup_address, dropoff_address, client_id")
          .eq("id", shipment.transport_request_id)
          .single()
      : { data: null };
    const [driver, staff] = await Promise.all([
      getAudience(assignment.driver_id),
      listAudienceByRoles(STAFF_ROLES),
    ]);
    const driverName = driver?.full_name || driver?.email || "Le chauffeur";
    const route = req ? routeLabel(req.pickup_address, req.dropoff_address) : "Mission";
    const when = shipment ? formatDate(shipment.scheduled_at) : "";

    await notifyUsers(
      staff,
      {
        type,
        title: accepted ? "Mission acceptée par le chauffeur" : "Mission refusée par le chauffeur",
        body: `${driverName} · ${route}${when ? ` · ${when}` : ""}`,
        url: "/dashboard/requests",
        tag: `assignment-${assignment.id}-response`,
        data: { assignment_id: assignment.id, shipment_id: assignment.shipment_id },
      },
      {
        email: () =>
          alertEmail({
            subject: accepted ? "Mission acceptée par le chauffeur" : "Mission refusée par le chauffeur",
            title: accepted ? "Mission acceptée" : "Mission refusée",
            intro: `${driverName} a ${accepted ? "accepté" : "refusé"} la mission affectée.`,
            lines: [`Trajet : ${route}`, ...(when ? [`Départ prévu : ${when}`] : [])],
            actionLabel: "Ouvrir les dossiers",
            actionUrl: `${APP_URL}/dashboard/requests`,
          }),
      },
    );

    if (accepted && req) {
      const client = await getAudience(req.client_id);
      if (client) {
        await notifyUsers(
          [client],
          {
            type: "driver_assigned",
            title: "Un chauffeur est affecté à votre mission",
            body: `${driverName} · ${route}`,
            url: "/dashboard/requests",
            tag: `assignment-${assignment.id}-client`,
            data: { assignment_id: assignment.id, shipment_id: assignment.shipment_id },
          },
          {
            email: (audience) =>
              alertEmail({
                subject: "Votre chauffeur est affecté",
                title: "Chauffeur affecté",
                intro: `Bonjour ${audience.full_name || audience.email}, ${driverName} prend en charge votre mission.`,
                lines: [`Trajet : ${route}`, ...(when ? [`Départ prévu : ${when}`] : [])],
                actionLabel: "Suivre ma mission",
                actionUrl: `${APP_URL}/dashboard/requests`,
              }),
          },
        );
      }
    }
    return done();
  }

  if (type === "delivery_proved") {
    const { data: shipment } = await supabase
      .from("shipments")
      .select("id, status, phase, transport_request_id")
      .eq("id", id)
      .single();
    if (!shipment) return notFound("Mission introuvable");

    const { data: req } = shipment.transport_request_id
      ? await supabase
          .from("transport_requests")
          .select("pickup_address, dropoff_address, client_id")
          .eq("id", shipment.transport_request_id)
          .single()
      : { data: null };
    const { data: proof } = await supabase
      .from("delivery_proofs")
      .select("recipient_name")
      .eq("shipment_id", shipment.id)
      .maybeSingle();

    const [client, staff] = await Promise.all([
      getAudience(req?.client_id),
      listAudienceByRoles(STAFF_ROLES),
    ]);
    const route = req ? routeLabel(req.pickup_address, req.dropoff_address) : "Mission";
    const recipient = (proof as { recipient_name?: string } | null)?.recipient_name;

    await notifyUsers(
      staff,
      {
        type,
        title: "Livraison validée",
        body: `${route}${recipient ? ` · reçu par ${recipient}` : ""}`,
        url: "/dashboard/requests",
        tag: `shipment-${shipment.id}-delivered-staff`,
        data: { shipment_id: shipment.id },
      },
      {
        email: () =>
          alertEmail({
            subject: "Livraison validée",
            title: "Livraison validée",
            intro: "Une mission vient d'être clôturée avec preuve de livraison.",
            lines: [`Trajet : ${route}`, ...(recipient ? [`Reçu par : ${recipient}`] : [])],
            actionLabel: "Ouvrir les dossiers",
            actionUrl: `${APP_URL}/dashboard/requests`,
          }),
      },
    );

    if (client) {
      await notifyUsers(
        [client],
        {
          type,
          title: "Livraison confirmée",
          body: `${route} : merci de votre confiance.`,
          url: "/dashboard/requests",
          tag: `shipment-${shipment.id}-delivered-client`,
          data: { shipment_id: shipment.id },
        },
        {
          email: (audience) =>
            alertEmail({
              subject: "Votre livraison est confirmée",
              title: "Livraison confirmée",
              intro: `Bonjour ${audience.full_name || audience.email}, votre livraison a bien été réceptionnée.`,
              lines: [`Trajet : ${route}`, ...(recipient ? [`Reçu par : ${recipient}`] : [])],
              actionLabel: "Ouvrir mon espace",
              actionUrl: `${APP_URL}/dashboard/requests`,
            }),
        },
      );
    }
    return done();
  }

  if (
    type === "shipment_confirmed" ||
    type === "shipment_started" ||
    type === "shipment_completed" ||
    type === "shipment_cancelled"
  ) {
    const { data: shipment } = await supabase
      .from("shipments")
      .select("id, status, transport_request_id")
      .eq("id", id)
      .single();
    if (!shipment) return notFound("Mission introuvable");

    const { data: req } = shipment.transport_request_id
      ? await supabase
          .from("transport_requests")
          .select("pickup_address, dropoff_address, client_id")
          .eq("id", shipment.transport_request_id)
          .single()
      : { data: null };
    const [client, staff, driver] = await Promise.all([
      getAudience(req?.client_id),
      listAudienceByRoles(STAFF_ROLES),
      getDriverAudience(shipment.id),
    ]);
    const route = req ? routeLabel(req.pickup_address, req.dropoff_address) : "Mission";
    const labels: Record<typeof type, { title: string; body: string }> = {
      shipment_confirmed: {
        title: "Mission confirmée",
        body: `${route} : votre transport est planifié.`,
      },
      shipment_started: {
        title: "Enlèvement en cours",
        body: `${route} : le chauffeur est en route.`,
      },
      shipment_completed: {
        title: "Mission terminée",
        body: `${route} : la mission est clôturée.`,
      },
      shipment_cancelled: {
        title: "Mission annulée",
        body: `${route} : la mission a été annulée.`,
      },
    };
    const label = labels[type];

    const audiences: Array<{ audience: NonNullable<typeof client>; suffix: string }> = [];
    if (client) audiences.push({ audience: client, suffix: "client" });
    if (type === "shipment_completed" || type === "shipment_cancelled") {
      for (const member of staff) audiences.push({ audience: member, suffix: "staff" });
      if (driver && type === "shipment_cancelled") {
        audiences.push({ audience: driver, suffix: "driver" });
      }
    }

    await Promise.all(
      audiences.map(({ audience, suffix }) =>
        notifyUsers(
          [audience],
          {
            type,
            title: label.title,
            body: label.body,
            url: "/dashboard/requests",
            tag: `shipment-${shipment.id}-${type}-${suffix}`,
            data: { shipment_id: shipment.id },
          },
          suffix === "client"
            ? {
                email: (target) =>
                  alertEmail({
                    subject: label.title,
                    title: label.title,
                    intro: `Bonjour ${target.full_name || target.email}, ${label.body}`,
                    actionLabel: "Ouvrir mon espace",
                    actionUrl: `${APP_URL}/dashboard/requests`,
                  }),
              }
            : undefined,
        ),
      ),
    );
    return done();
  }

  // invoice_sent
  const { data: invoice } = await supabase
    .from("invoices")
    .select("id, invoice_number, amount, currency, due_at, client_id")
    .eq("id", id)
    .single();
  if (!invoice) return notFound("Facture introuvable");

  const client = await getAudience(invoice.client_id);
  if (!client) return notFound("Destinataire introuvable");

  const invoiceNumber = invoice.invoice_number || id.slice(0, 8);
  await notifyUsers(
    [client],
    {
      type: "invoice_sent",
      title: "Facture à régler",
      body: `Facture ${invoiceNumber} · ${money(Number(invoice.amount), invoice.currency)}`,
      url: `/dashboard/invoices/${invoice.id}`,
      tag: `invoice-${invoice.id}`,
      data: { invoice_id: invoice.id },
    },
    {
      email: (audience) =>
        invoiceSentEmail({
          clientName: audience.full_name || audience.email,
          invoiceNumber,
          amount: Number(invoice.amount),
          currency: invoice.currency,
          dueAt: invoice.due_at,
          domain: APP_URL,
        }),
    },
  );

  await supabase
    .from("invoices")
    .update({ status: "sent" })
    .eq("id", invoice.id)
    .eq("status", "issued");

  return done();
}
