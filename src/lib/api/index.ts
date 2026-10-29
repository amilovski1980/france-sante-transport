import { createClient } from "@/lib/supabase/client";
import { AppError, mapError } from "@/lib/errors";
import type {
  ContactMessage,
  ContactTopic,
  DriverAssignment,
  Profile,
  Quote,
  QuoteLine,
  ServiceType,
  Shipment,
  ShipmentEvent,
  SiteSettings,
  TransportRequest,
  Vehicle,
} from "@/lib/types";

export interface CreateRequestInput {
  service_type: ServiceType;
  pickup_address: string;
  dropoff_address: string;
  pickup_datetime: string;
  patient_name?: string;
  mobility_notes?: string;
  contact_phone?: string;
  notes?: string;
  organization_id?: string;
}

async function call<T>(fn: () => Promise<{ data: T | null; error: unknown }>): Promise<T> {
  try {
    const { data, error } = await fn();
    if (error) {
      throw error;
    }
    if (data === null || data === undefined) {
      throw new AppError("server", "Le serveur n'a renvoyé aucune donnée.");
    }
    return data;
  } catch (error) {
    throw mapError(error);
  }
}

// ------------------------------------------------------------
// Notifications e-mail (fire-and-forget : jamais bloquant pour le flux métier)
// ------------------------------------------------------------
export type NotifyType = "quote_sent" | "assignment_proposed" | "request_received";

export async function notify(type: NotifyType, id: string): Promise<void> {
  try {
    await fetch("/api/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, id }),
    });
  } catch (err) {
    console.warn("[notify] envoi impossible :", err);
  }
}

// ------------------------------------------------------------
// Demandes de transport
// ------------------------------------------------------------

export async function createTransportRequest(input: CreateRequestInput): Promise<TransportRequest> {
  const request = await call<TransportRequest>(async () => {
    const supabase = createClient();
    return supabase.from("transport_requests").insert(input).select().single();
  });
  void notify("request_received", request.id);
  return request;
}

export async function listMyRequests(): Promise<TransportRequest[]> {
  return call(async () => {
    const supabase = createClient();
    return supabase
      .from("transport_requests")
      .select("*")
      .order("created_at", { ascending: false });
  });
}

export async function listAllRequests(): Promise<TransportRequest[]> {
  return call(async () => {
    const supabase = createClient();
    return supabase
      .from("transport_requests")
      .select("*")
      .order("created_at", { ascending: false });
  });
}

export async function cancelMyRequest(requestId: string, reason?: string): Promise<TransportRequest> {
  return call(async () => {
    const supabase = createClient();
    return supabase.rpc("cancel_transport_request", {
      p_request_id: requestId,
      p_reason: reason ?? null,
    });
  });
}

// ------------------------------------------------------------
// Devis
// ------------------------------------------------------------

export async function listQuotesForRequest(requestId: string): Promise<Quote[]> {
  return call(async () => {
    const supabase = createClient();
    return supabase
      .from("quotes")
      .select("*")
      .eq("transport_request_id", requestId)
      .order("version", { ascending: false });
  });
}

export async function listMyQuotes(): Promise<Quote[]> {
  return call(async () => {
    const supabase = createClient();
    return supabase.from("quotes").select("*").order("created_at", { ascending: false });
  });
}

export async function adminCreateQuote(input: {
  transport_request_id: string;
  amount: number;
  valid_until?: string | null;
  notes?: string | null;
}): Promise<Quote> {
  return call(async () => {
    const supabase = createClient();
    return supabase.rpc("create_quote", {
      p_transport_request_id: input.transport_request_id,
      p_amount: input.amount,
      p_valid_until: input.valid_until ?? null,
      p_notes: input.notes ?? null,
    });
  });
}

export async function adminSendQuote(quoteId: string): Promise<Quote> {
  const quote = await call(async () => {
    const supabase = createClient();
    return supabase.rpc("send_quote", { p_quote_id: quoteId });
  });
  void notify("quote_sent", quote.id);
  return quote;
}

export async function acceptQuote(quoteId: string): Promise<Shipment> {
  return call(async () => {
    const supabase = createClient();
    return supabase.rpc("accept_quote", { p_quote_id: quoteId });
  });
}

export async function declineQuote(quoteId: string): Promise<Quote> {
  return call(async () => {
    const supabase = createClient();
    return supabase.rpc("decline_quote", { p_quote_id: quoteId });
  });
}

export async function markRequestUnderReview(requestId: string): Promise<TransportRequest> {
  return call(async () => {
    const supabase = createClient();
    return supabase.rpc("mark_request_under_review", { p_request_id: requestId });
  });
}

// ------------------------------------------------------------
// Lignes de devis (détail des prestations)
// ------------------------------------------------------------

export interface QuoteLineInput {
  description: string;
  quantity: number;
  unit_price: number;
}

export async function listQuoteLines(quoteId: string): Promise<QuoteLine[]> {
  return call(async () => {
    const supabase = createClient();
    return supabase
      .from("quote_lines")
      .select("*")
      .eq("quote_id", quoteId)
      .order("position", { ascending: true });
  });
}

export async function addQuoteLine(quoteId: string, input: QuoteLineInput): Promise<QuoteLine> {
  return call(async () => {
    const supabase = createClient();
    return supabase.rpc("add_quote_line", {
      p_quote_id: quoteId,
      p_description: input.description,
      p_quantity: input.quantity,
      p_unit_price: input.unit_price,
    });
  });
}

export async function updateQuoteLine(lineId: string, input: QuoteLineInput): Promise<QuoteLine> {
  return call(async () => {
    const supabase = createClient();
    return supabase.rpc("update_quote_line", {
      p_line_id: lineId,
      p_description: input.description,
      p_quantity: input.quantity,
      p_unit_price: input.unit_price,
    });
  });
}

export async function deleteQuoteLine(lineId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("delete_quote_line", { p_line_id: lineId });
  if (error) {
    throw mapError(error);
  }
}

// ------------------------------------------------------------
// Position GPS du chauffeur (partage temps réel)
// ------------------------------------------------------------

export async function shareDriverPosition(
  lat: number,
  lng: number,
  accuracy?: number | null,
  shared = true,
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("share_driver_position", {
    p_lat: lat,
    p_lng: lng,
    p_accuracy: accuracy ?? null,
    p_shared: shared,
  });
  if (error) {
    throw mapError(error);
  }
}

/**
 * Position partagée du chauffeur affecté à une mission, pour le client
 * propriétaire de la demande. Contrôle d'accès assuré côté serveur par la
 * RPC `shipment_driver_position` (RLS de driver_positions inchangée).
 */
export interface ShipmentDriverPosition {
  lat: number | null;
  lng: number | null;
  accuracy: number | null;
  shared: boolean;
  updated_at: string | null;
}

export async function getShipmentDriverPosition(
  shipmentId: string,
): Promise<ShipmentDriverPosition> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("shipment_driver_position", {
    p_shipment_id: shipmentId,
  });
  if (error) {
    throw mapError(error);
  }
  const row = Array.isArray(data) ? data[0] : data;
  return (
    (row as ShipmentDriverPosition | null) ?? {
      lat: null,
      lng: null,
      accuracy: null,
      shared: false,
      updated_at: null,
    }
  );
}

export interface ShipmentTrackPoint {
  lat: number;
  lng: number;
  recorded_at: string;
}

/** Trace (polyline) des positions du chauffeur affecte a une mission. */
export async function getShipmentTrack(
  shipmentId: string,
  hoursBefore = 6,
): Promise<ShipmentTrackPoint[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("shipment_track", {
    p_shipment_id: shipmentId,
    p_hours_before: hoursBefore,
  });
  if (error) {
    throw mapError(error);
  }
  return (data as ShipmentTrackPoint[] | null) ?? [];
}

// ------------------------------------------------------------
// Missions
// ------------------------------------------------------------

export async function listShipments(): Promise<Shipment[]> {
  return call(async () => {
    const supabase = createClient();
    return supabase.from("shipments").select("*").order("scheduled_at", { ascending: true });
  });
}

export async function adminConfirmShipment(shipmentId: string): Promise<Shipment> {
  return call(async () => {
    const supabase = createClient();
    return supabase.rpc("confirm_shipment", { p_shipment_id: shipmentId });
  });
}

export async function adminStartShipment(shipmentId: string): Promise<Shipment> {
  return call(async () => {
    const supabase = createClient();
    return supabase.rpc("start_shipment", { p_shipment_id: shipmentId });
  });
}

export async function adminCompleteShipment(shipmentId: string): Promise<Shipment> {
  return call(async () => {
    const supabase = createClient();
    return supabase.rpc("complete_shipment", { p_shipment_id: shipmentId });
  });
}

export async function adminCancelShipment(shipmentId: string, reason?: string): Promise<Shipment> {
  return call(async () => {
    const supabase = createClient();
    return supabase.rpc("cancel_shipment", { p_shipment_id: shipmentId, p_reason: reason ?? null });
  });
}

export async function assignDriver(
  shipmentId: string,
  driverId: string,
  vehicleId: string,
): Promise<DriverAssignment> {
  const assignment = await call(async () => {
    const supabase = createClient();
    return supabase.rpc("assign_driver", {
      p_shipment_id: shipmentId,
      p_driver_id: driverId,
      p_vehicle_id: vehicleId,
    });
  });
  void notify("assignment_proposed", assignment.id);
  return assignment;
}

// ------------------------------------------------------------
// Administration : profils, rôles, flotte
// ------------------------------------------------------------

export async function adminUpdateProfile(input: {
  userId: string;
  full_name?: string | null;
  phone?: string | null;
  address?: string | null;
  avatar_url?: string | null;
  role?: Profile["role"] | null;
}): Promise<Profile> {
  return call(async () => {
    const supabase = createClient();
    return supabase.rpc("admin_update_profile", {
      p_user_id: input.userId,
      p_full_name: input.full_name ?? null,
      p_phone: input.phone ?? null,
      p_address: input.address ?? null,
      p_avatar_url: input.avatar_url ?? null,
      p_role: input.role ?? null,
    });
  });
}

export async function updateOwnProfile(input: {
  full_name?: string | null;
  phone?: string | null;
  address?: string | null;
  avatar_url?: string | null;
}): Promise<Profile> {
  return call(async () => {
    const supabase = createClient();
    return supabase.rpc("update_own_profile", {
      p_full_name: input.full_name ?? null,
      p_phone: input.phone ?? null,
      p_address: input.address ?? null,
      p_avatar_url: input.avatar_url ?? null,
    });
  });
}

export async function listAllProfiles(): Promise<Profile[]> {
  return call(async () => {
    const supabase = createClient();
    return supabase.from("profiles").select("*").order("created_at", { ascending: true });
  });
}

export async function setUserRole(userId: string, role: Profile["role"]): Promise<Profile> {
  return call(async () => {
    const supabase = createClient();
    return supabase.rpc("set_user_role", { p_user_id: userId, p_role: role });
  });
}

export async function listVehicles(): Promise<Vehicle[]> {
  return call(async () => {
    const supabase = createClient();
    return supabase.from("vehicles").select("*").order("registration_plate", { ascending: true });
  });
}

export async function createVehicle(input: {
  registration_plate: string;
  vehicle_type: Vehicle["vehicle_type"];
  capacity: number;
  has_wheelchair_lift: boolean;
}): Promise<Vehicle> {
  return call(async () => {
    const supabase = createClient();
    return supabase.from("vehicles").insert(input).select().single();
  });
}

export async function updateVehicleActive(vehicleId: string, active: boolean): Promise<Vehicle> {
  return call(async () => {
    const supabase = createClient();
    return supabase.from("vehicles").update({ active }).eq("id", vehicleId).select().single();
  });
}

// ------------------------------------------------------------
// Journal d'événements
// ------------------------------------------------------------

export async function listEventsForRequest(requestId: string): Promise<ShipmentEvent[]> {
  return call(async () => {
    const supabase = createClient();
    return supabase
      .from("shipment_events")
      .select("*")
      .eq("transport_request_id", requestId)
      .order("created_at", { ascending: true });
  });
}

export async function listEventsForShipment(shipmentId: string): Promise<ShipmentEvent[]> {
  return call(async () => {
    const supabase = createClient();
    return supabase
      .from("shipment_events")
      .select("*")
      .eq("shipment_id", shipmentId)
      .order("created_at", { ascending: true });
  });
}

// ------------------------------------------------------------
// Chauffeurs
// ------------------------------------------------------------

export async function listMyAssignments(driverId: string): Promise<DriverAssignment[]> {
  return call(async () => {
    const supabase = createClient();
    return supabase
      .from("driver_assignments")
      .select("*")
      .eq("driver_id", driverId)
      .order("assigned_at", { ascending: false });
  });
}

export async function respondToAssignment(assignmentId: string, accept: boolean): Promise<DriverAssignment> {
  return call(async () => {
    const supabase = createClient();
    return supabase.rpc("respond_driver_assignment", {
      p_assignment_id: assignmentId,
      p_accept: accept,
    });
  });
}

// ------------------------------------------------------------
// Messages de contact / apport d'affaires
// ------------------------------------------------------------

export async function sendContactMessage(input: {
  topic: ContactTopic;
  full_name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
}): Promise<ContactMessage> {
  return call(async () => {
    const supabase = createClient();
    return supabase.from("contact_messages").insert(input).select().single();
  });
}

// ------------------------------------------------------------
// Personnalisation du site (réglages d'identité visuelle)
// ------------------------------------------------------------

export async function getSiteSettings(): Promise<SiteSettings> {
  return call(async () => {
    const supabase = createClient();
    return supabase.from("site_settings").select("*").eq("id", 1).single();
  });
}

export async function updateSiteSettings(input: {
  logo_url?: string | null;
  logo_alt?: string | null;
  slogan?: string | null;
  custom_css?: string | null;
}): Promise<SiteSettings> {
  return call(async () => {
    const supabase = createClient();
    return supabase.from("site_settings").update(input).eq("id", 1).select().single();
  });
}
