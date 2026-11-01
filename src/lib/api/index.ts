import { createClient } from "@/lib/supabase/client";
import { AppError, mapError } from "@/lib/errors";
import type {
  ContactMessage,
  ContactTopic,
  Delivery,
  DeliveryItem,
  DeliveryReminder,
  DeliverySchedule,
  DeliveryScheduleLine,
  DriverAssignment,
  Lot,
  OrganizationMember,
  OrgRole,
  PreparationOrder,
  PreparationOrderLine,
  Product,
  ProductReference,
  Profile,
  PurchaseInvoice,
  PurchaseInvoiceLine,
  Quote,
  QuoteLine,
  Recipient,
  ServiceType,
  Shipment,
  ShipmentEvent,
  SiteSettings,
  StockLevel,
  StockMovement,
  Supplier,
  TransportRequest,
  Vehicle,
  Warehouse,
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

export interface ContactFormData {
  name: string;
  email: string;
  subject: string;
  message: string;
  topic: ContactTopic;
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
export type NotifyType =
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
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Non connecte");
    return supabase.from("transport_requests").insert({ ...input, client_id: user.id }).select().single();
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
  const request = await call<TransportRequest>(async () => {
    const supabase = createClient();
    return supabase.rpc("cancel_transport_request", {
      p_request_id: requestId,
      p_reason: reason ?? null,
    });
  });
  void notify("request_cancelled", requestId);
  return request;
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
  const shipment = await call<Shipment>(async () => {
    const supabase = createClient();
    return supabase.rpc("accept_quote", { p_quote_id: quoteId });
  });
  void notify("quote_accepted", quoteId);
  return shipment;
}

export async function declineQuote(quoteId: string): Promise<Quote> {
  const quote = await call<Quote>(async () => {
    const supabase = createClient();
    return supabase.rpc("decline_quote", { p_quote_id: quoteId });
  });
  void notify("quote_declined", quoteId);
  return quote;
}

export async function markRequestUnderReview(requestId: string): Promise<TransportRequest> {
  const request = await call<TransportRequest>(async () => {
    const supabase = createClient();
    return supabase.rpc("mark_request_under_review", { p_request_id: requestId });
  });
  void notify("request_under_review", requestId);
  return request;
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
  const shipment = await call<Shipment>(async () => {
    const supabase = createClient();
    return supabase.rpc("confirm_shipment", { p_shipment_id: shipmentId });
  });
  void notify("shipment_confirmed", shipmentId);
  return shipment;
}

export async function adminStartShipment(shipmentId: string): Promise<Shipment> {
  const shipment = await call<Shipment>(async () => {
    const supabase = createClient();
    return supabase.rpc("start_shipment", { p_shipment_id: shipmentId });
  });
  void notify("shipment_started", shipmentId);
  return shipment;
}

export async function adminCompleteShipment(shipmentId: string): Promise<Shipment> {
  const shipment = await call<Shipment>(async () => {
    const supabase = createClient();
    return supabase.rpc("complete_shipment", { p_shipment_id: shipmentId });
  });
  void notify("shipment_completed", shipmentId);
  return shipment;
}

export async function adminCancelShipment(shipmentId: string, reason?: string): Promise<Shipment> {
  const shipment = await call<Shipment>(async () => {
    const supabase = createClient();
    return supabase.rpc("cancel_shipment", { p_shipment_id: shipmentId, p_reason: reason ?? null });
  });
  void notify("shipment_cancelled", shipmentId);
  return shipment;
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

export async function cancelAssignment(assignmentId: string): Promise<DriverAssignment> {
  return call<DriverAssignment>(async () => {
    const supabase = createClient();
    return supabase.rpc("cancel_driver_assignment", { p_assignment_id: assignmentId });
  });
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
  const assignment = await call<DriverAssignment>(async () => {
    const supabase = createClient();
    return supabase.rpc("respond_driver_assignment", {
      p_assignment_id: assignmentId,
      p_accept: accept,
    });
  });
  void notify("assignment_response", assignmentId);
  return assignment;
}

// ------------------------------------------------------------
// Messages de contact / apport d'affaires
// ------------------------------------------------------------

export async function submitContact(input: {
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
  social_facebook?: string | null;
  social_linkedin?: string | null;
  social_x?: string | null;
  social_instagram?: string | null;
  newsletter_url?: string | null;
  home_hero_image?: string | null;
  home_visual_image?: string | null;
}): Promise<SiteSettings> {
  return call(async () => {
    const supabase = createClient();
    return supabase.from("site_settings").update(input).eq("id", 1).select().single();
  });
}

// ------------------------------------------------------------
// Supply chain : fournisseurs, entrepôts, catalogue, stock
// ------------------------------------------------------------

export async function listSuppliers(): Promise<Supplier[]> {
  return call(async () => {
    const supabase = createClient();
    return supabase.from("suppliers").select("*").order("code");
  });
}

export async function adminCreateSupplier(input: {
  organization_name: string;
  code: string;
  contact_email?: string | null;
  contact_phone?: string | null;
  siret?: string | null;
  address?: string | null;
}): Promise<Supplier> {
  return call(async () => {
    const supabase = createClient();
    return supabase.rpc("admin_create_supplier", {
      p_organization_name: input.organization_name,
      p_code: input.code,
      p_contact_email: input.contact_email ?? null,
      p_contact_phone: input.contact_phone ?? null,
      p_siret: input.siret ?? null,
      p_address: input.address ?? null,
    });
  });
}

export async function adminAttachSupplierMember(
  supplierId: string,
  userId: string,
  orgRole: OrgRole = "member",
): Promise<OrganizationMember> {
  return call(async () => {
    const supabase = createClient();
    return supabase.rpc("admin_attach_supplier_member", {
      p_supplier_id: supplierId,
      p_user_id: userId,
      p_org_role: orgRole,
    });
  });
}

export async function listWarehouses(): Promise<Warehouse[]> {
  return call(async () => {
    const supabase = createClient();
    return supabase.from("warehouses").select("*").order("name");
  });
}

export async function createWarehouse(input: {
  name: string;
  code: string;
  address?: string | null;
  capacity_m3?: number | null;
}): Promise<Warehouse> {
  return call(async () => {
    const supabase = createClient();
    return supabase.from("warehouses").insert(input).select().single();
  });
}

export async function updateWarehouse(
  id: string,
  input: Partial<Pick<Warehouse, "name" | "code" | "address" | "capacity_m3" | "active">>,
): Promise<Warehouse> {
  return call(async () => {
    const supabase = createClient();
    return supabase.from("warehouses").update(input).eq("id", id).select().single();
  });
}

export async function listProducts(): Promise<Product[]> {
  return call(async () => {
    const supabase = createClient();
    return supabase.from("products").select("*").order("name");
  });
}

export async function createProduct(input: {
  supplier_id: string;
  name: string;
  description?: string | null;
  category?: string | null;
  unit?: string;
  requires_cold_chain?: boolean;
  temp_min?: number | null;
  temp_max?: number | null;
}): Promise<Product> {
  return call(async () => {
    const supabase = createClient();
    return supabase.from("products").insert(input).select().single();
  });
}

export async function updateProduct(
  id: string,
  input: Partial<Pick<Product, "name" | "description" | "category" | "unit" | "requires_cold_chain" | "temp_min" | "temp_max" | "active">>,
): Promise<Product> {
  return call(async () => {
    const supabase = createClient();
    return supabase.from("products").update(input).eq("id", id).select().single();
  });
}

export async function listProductReferences(): Promise<ProductReference[]> {
  return call(async () => {
    const supabase = createClient();
    return supabase.from("product_references").select("*").order("reference_code");
  });
}

export async function createProductReference(input: {
  product_id: string;
  reference_code: string;
  gtin?: string | null;
  packaging?: string | null;
  unit?: string | null;
}): Promise<ProductReference> {
  return call(async () => {
    const supabase = createClient();
    return supabase.from("product_references").insert(input).select().single();
  });
}

export async function listLots(): Promise<Lot[]> {
  return call(async () => {
    const supabase = createClient();
    return supabase.from("lots").select("*").order("expiry_date", { ascending: true, nullsFirst: false });
  });
}

export async function listStockLevels(): Promise<StockLevel[]> {
  return call(async () => {
    const supabase = createClient();
    return supabase.from("stock_levels").select("*");
  });
}

export async function listStockMovements(limit = 100): Promise<StockMovement[]> {
  return call(async () => {
    const supabase = createClient();
    return supabase
      .from("stock_movements")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
  });
}

export async function receiveStock(input: {
  supplier_id: string;
  warehouse_id: string;
  product_reference_id: string;
  lot_number: string;
  quantity: number;
  expiry_date?: string | null;
  reference_type?: string | null;
  reference_id?: string | null;
  note?: string | null;
}): Promise<StockLevel> {
  return call(async () => {
    const supabase = createClient();
    return supabase.rpc("receive_stock", {
      p_supplier_id: input.supplier_id,
      p_warehouse_id: input.warehouse_id,
      p_product_reference_id: input.product_reference_id,
      p_lot_number: input.lot_number,
      p_quantity: input.quantity,
      p_expiry_date: input.expiry_date ?? null,
      p_reference_type: input.reference_type ?? "manual",
      p_reference_id: input.reference_id ?? null,
      p_note: input.note ?? null,
    });
  });
}

// ------------------------------------------------------------
// Destinataires
// ------------------------------------------------------------

export async function listRecipients(): Promise<Recipient[]> {
  return call(async () => {
    const supabase = createClient();
    return supabase.from("recipients").select("*").order("name");
  });
}

export async function createRecipient(input: {
  supplier_id: string | null;
  name: string;
  type: Recipient["type"];
  contact_name?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  postal_code?: string | null;
  notes?: string | null;
}): Promise<Recipient> {
  return call(async () => {
    const supabase = createClient();
    return supabase.from("recipients").insert(input).select().single();
  });
}

export async function updateRecipient(
  id: string,
  input: Partial<Omit<Recipient, "id" | "created_at" | "updated_at" | "created_by">>,
): Promise<Recipient> {
  return call(async () => {
    const supabase = createClient();
    return supabase.from("recipients").update(input).eq("id", id).select().single();
  });
}

export async function deleteRecipient(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("recipients").delete().eq("id", id);
  if (error) throw mapError(error);
}

// ------------------------------------------------------------
// Plannings de livraison
// ------------------------------------------------------------

export async function listDeliverySchedules(): Promise<DeliverySchedule[]> {
  return call(async () => {
    const supabase = createClient();
    return supabase
      .from("delivery_schedules")
      .select("*")
      .order("requested_date", { ascending: false });
  });
}

export async function listDeliveryScheduleLines(): Promise<DeliveryScheduleLine[]> {
  return call(async () => {
    const supabase = createClient();
    return supabase.from("delivery_schedule_lines").select("*");
  });
}

export async function createDeliverySchedule(input: {
  supplier_id: string;
  warehouse_id: string;
  requested_date: string;
  label?: string | null;
  notes?: string | null;
}): Promise<DeliverySchedule> {
  return call(async () => {
    const supabase = createClient();
    return supabase.rpc("create_delivery_schedule", {
      p_supplier_id: input.supplier_id,
      p_warehouse_id: input.warehouse_id,
      p_requested_date: input.requested_date,
      p_label: input.label ?? null,
      p_notes: input.notes ?? null,
    });
  });
}

export async function addDeliveryScheduleLine(input: {
  schedule_id: string;
  recipient_id: string;
  lot_id: string;
  quantity: number;
  unit?: string | null;
  notes?: string | null;
}): Promise<DeliveryScheduleLine> {
  return call(async () => {
    const supabase = createClient();
    return supabase.rpc("add_delivery_schedule_line", {
      p_schedule_id: input.schedule_id,
      p_recipient_id: input.recipient_id,
      p_lot_id: input.lot_id,
      p_quantity: input.quantity,
      p_unit: input.unit ?? null,
      p_notes: input.notes ?? null,
    });
  });
}

export async function updateDeliverySchedule(input: {
  schedule_id: string;
  label?: string | null;
  notes?: string | null;
  requested_date?: string | null;
  warehouse_id?: string | null;
}): Promise<DeliverySchedule> {
  return call(async () => {
    const supabase = createClient();
    return supabase.rpc("update_delivery_schedule", {
      p_schedule_id: input.schedule_id,
      p_label: input.label ?? null,
      p_notes: input.notes ?? null,
      p_requested_date: input.requested_date ?? null,
      p_warehouse_id: input.warehouse_id ?? null,
    });
  });
}

export async function deleteDeliverySchedule(scheduleId: string): Promise<DeliverySchedule> {
  return call(async () => {
    const supabase = createClient();
    return supabase.rpc("delete_delivery_schedule", { p_schedule_id: scheduleId });
  });
}

export async function removeDeliveryScheduleLine(lineId: string): Promise<DeliveryScheduleLine> {
  return call(async () => {
    const supabase = createClient();
    return supabase.rpc("remove_delivery_schedule_line", { p_line_id: lineId });
  });
}

export async function validateDeliverySchedule(scheduleId: string): Promise<DeliverySchedule> {
  return call(async () => {
    const supabase = createClient();
    return supabase.rpc("validate_delivery_schedule", { p_schedule_id: scheduleId });
  });
}

export async function transmitDeliverySchedule(scheduleId: string): Promise<DeliverySchedule> {
  return call(async () => {
    const supabase = createClient();
    return supabase.rpc("transmit_delivery_schedule", { p_schedule_id: scheduleId });
  });
}

export async function cancelDeliverySchedule(scheduleId: string): Promise<DeliverySchedule> {
  return call(async () => {
    const supabase = createClient();
    return supabase.rpc("cancel_delivery_schedule", { p_schedule_id: scheduleId });
  });
}

// ------------------------------------------------------------
// Préparation et livraisons
// ------------------------------------------------------------

export async function listPreparationOrders(): Promise<PreparationOrder[]> {
  return call(async () => {
    const supabase = createClient();
    return supabase.from("preparation_orders").select("*").order("created_at", { ascending: false });
  });
}

export async function listPreparationOrderLines(): Promise<PreparationOrderLine[]> {
  return call(async () => {
    const supabase = createClient();
    return supabase.from("preparation_order_lines").select("*");
  });
}

export async function setPreparationOrderStatus(
  orderId: string,
  status: PreparationOrder["status"],
  note?: string | null,
): Promise<PreparationOrder> {
  return call(async () => {
    const supabase = createClient();
    return supabase.rpc("set_preparation_order_status", {
      p_order_id: orderId,
      p_status: status,
      p_note: note ?? null,
    });
  });
}

export async function recordPreparationProgress(
  lineId: string,
  quantityPrepared: number,
): Promise<PreparationOrderLine> {
  return call(async () => {
    const supabase = createClient();
    return supabase.rpc("record_preparation_progress", {
      p_line_id: lineId,
      p_quantity_prepared: quantityPrepared,
    });
  });
}

export async function listDeliveries(): Promise<Delivery[]> {
  return call(async () => {
    const supabase = createClient();
    return supabase.from("deliveries").select("*").order("scheduled_at", { ascending: true, nullsFirst: false });
  });
}

export async function listDeliveryItems(): Promise<DeliveryItem[]> {
  return call(async () => {
    const supabase = createClient();
    return supabase.from("delivery_items").select("*");
  });
}

export async function assignDeliveryMission(
  deliveryId: string,
  driverId: string,
  vehicleId: string,
): Promise<DriverAssignment> {
  const assignment = await call<DriverAssignment>(async () => {
    const supabase = createClient();
    return supabase.rpc("assign_delivery_mission", {
      p_delivery_id: deliveryId,
      p_driver_id: driverId,
      p_vehicle_id: vehicleId,
    });
  });
  void notify("assignment_proposed", assignment.id);
  return assignment;
}

export async function confirmDeliveryWithProof(input: {
  delivery_id: string;
  recipient_name: string;
  signature_data: string;
  note?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}): Promise<Delivery> {
  return call(async () => {
    const supabase = createClient();
    return supabase.rpc("confirm_delivery_with_proof", {
      p_delivery_id: input.delivery_id,
      p_recipient_name: input.recipient_name,
      p_signature_data: input.signature_data,
      p_note: input.note ?? null,
      p_latitude: input.latitude ?? null,
      p_longitude: input.longitude ?? null,
    });
  });
}

export async function listDeliveryReminders(): Promise<DeliveryReminder[]> {
  return call(async () => {
    const supabase = createClient();
    return supabase.from("delivery_reminders").select("*").order("scheduled_for", { ascending: true });
  });
}

// ------------------------------------------------------------
// Factures d'achat
// ------------------------------------------------------------

export async function listPurchaseInvoices(): Promise<PurchaseInvoice[]> {
  return call(async () => {
    const supabase = createClient();
    return supabase.from("purchase_invoices").select("*").order("created_at", { ascending: false });
  });
}

export async function createPurchaseInvoice(input: {
  supplier_id: string;
  invoice_number: string;
  invoice_date?: string | null;
  total_amount?: number | null;
  file_path?: string | null;
  file_name?: string | null;
  mime_type?: string | null;
}): Promise<PurchaseInvoice> {
  return call(async () => {
    const supabase = createClient();
    return supabase.from("purchase_invoices").insert(input).select().single();
  });
}

export async function updatePurchaseInvoice(
  id: string,
  input: Partial<Pick<PurchaseInvoice, "invoice_number" | "invoice_date" | "total_amount" | "file_path" | "file_name" | "mime_type" | "extraction_status" | "extracted_data">>,
): Promise<PurchaseInvoice> {
  return call(async () => {
    const supabase = createClient();
    return supabase.from("purchase_invoices").update(input).eq("id", id).select().single();
  });
}

export async function listPurchaseInvoiceLines(): Promise<PurchaseInvoiceLine[]> {
  return call(async () => {
    const supabase = createClient();
    return supabase.from("purchase_invoice_lines").select("*").order("created_at", { ascending: true });
  });
}

export async function createPurchaseInvoiceLine(input: {
  purchase_invoice_id: string;
  product_reference_id?: string | null;
  description: string;
  quantity: number;
  unit_price?: number | null;
  lot_number?: string | null;
  expiry_date?: string | null;
}): Promise<PurchaseInvoiceLine> {
  return call(async () => {
    const supabase = createClient();
    return supabase.from("purchase_invoice_lines").insert(input).select().single();
  });
}

export async function deletePurchaseInvoiceLine(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("purchase_invoice_lines").delete().eq("id", id);
  if (error) throw mapError(error);
}
