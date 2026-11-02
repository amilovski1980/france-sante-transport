export type AppRole = "client" | "admin" | "dispatcher" | "driver" | "partner" | "supplier";
export type OrgKind = "client_company" | "facility" | "partner" | "supplier";
export type OrgRole = "owner" | "member" | "contact";
export type RequestStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "quoted"
  | "accepted"
  | "rejected"
  | "cancelled"
  | "completed";
export type ServiceType =
  | "medical_transport"
  | "wheelchair_transport"
  | "stretcher_transport"
  | "appointment_transfer"
  | "medical_supply"
  | "other";
export type ContentType = "organ" | "blood" | "equipment" | "other";
export type Criticality = "critical" | "urgent" | "standard";
export type VehicleClass = "moto" | "iveco" | "other";
export type MissionPhase = "validated" | "en_route" | "picked_up" | "in_transit" | "delivered";
export type QuoteStatus = "draft" | "sent" | "accepted" | "declined" | "expired" | "superseded";
export type ShipmentStatus =
  | "pending_confirmation"
  | "confirmed"
  | "in_progress"
  | "completed"
  | "cancelled";
export type ShipmentEventType =
  | "request_submitted"
  | "request_under_review"
  | "request_rejected"
  | "request_cancelled"
  | "quote_created"
  | "quote_sent"
  | "quote_accepted"
  | "quote_declined"
  | "quote_cancelled"
  | "mission_created"
  | "mission_confirmed"
  | "mission_in_progress"
  | "mission_completed"
  | "mission_cancelled"
  | "driver_assigned"
  | "driver_response"
  | "note"
  | "delivery_proved";
export type VehicleType = "sedan" | "van" | "minibus" | "stretcher_van" | "ambulance" | "moto";
export type AssignmentStatus = "proposed" | "accepted" | "declined" | "completed" | "cancelled";
export type ContactTopic = "contact" | "referral" | "quote_request" | "other";
export type MissionKind = "patient_transport" | "goods_delivery";
export type StockMovementType =
  | "receipt"
  | "reservation"
  | "release"
  | "shipment"
  | "adjustment"
  | "return";
export type DeliveryScheduleStatus =
  | "draft"
  | "validated"
  | "transmitted"
  | "planned"
  | "in_progress"
  | "completed"
  | "cancelled";
export type PreparationOrderStatus = "pending" | "preparing" | "ready" | "cancelled";
export type DeliveryStatus =
  | "pending"
  | "scheduled"
  | "in_progress"
  | "delivered"
  | "failed"
  | "cancelled";
export type PurchaseInvoiceExtractionStatus = "pending" | "parsed" | "failed" | "manual";
export type RecipientType = "laboratory" | "hospital" | "pharmacy" | "clinic" | "other";

/** Bloc « client » réutilisé par le générateur PDF (nom, e-mail, téléphone). */
export interface QuoteClient {
  full_name: string;
  email: string;
  phone: string | null;
}

export type EsignStatus = "created" | "sent" | "delivered" | "completed" | "declined" | "voided";
export type EsignScope = "quote" | "invoice" | "transport_order";

/** Enveloppe DocuSign (devis, facture, ordre de transport). */
export interface EsignDocument {
  id: string;
  scope: EsignScope;
  reference_id: string;
  envelope_id: string | null;
  status: EsignStatus;
  signer_email: string;
  signer_name: string;
  signed_pdf_path: string | null;
  signed_at: string | null;
  created_by: string | null;
  created_at: string;
}

/** Preuve de livraison : destinataire + signature manuscrite (PNG data URI). */
export interface DeliveryProof {
  id: string;
  shipment_id: string | null;
  delivery_id: string | null;
  recipient_name: string;
  signature_data: string;
  signature_hash: string | null;
  note: string | null;
  latitude: number | null;
  longitude: number | null;
  ip_address: string | null;
  user_agent: string | null;
  recorded_by: string;
  created_at: string;
  updated_at: string;
}

export interface Supplier {
  id: string;
  organization_id: string;
  code: string;
  contact_email: string | null;
  contact_phone: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Warehouse {
  id: string;
  name: string;
  code: string;
  address: string | null;
  capacity_m3: number | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  supplier_id: string;
  name: string;
  description: string | null;
  category: string | null;
  unit: string;
  requires_cold_chain: boolean;
  temp_min: number | null;
  temp_max: number | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProductReference {
  id: string;
  product_id: string;
  reference_code: string;
  gtin: string | null;
  packaging: string | null;
  unit: string | null;
  created_at: string;
  updated_at: string;
}

export interface Lot {
  id: string;
  product_reference_id: string;
  supplier_id: string;
  warehouse_id: string;
  lot_number: string;
  expiry_date: string | null;
  received_at: string;
  created_at: string;
  updated_at: string;
}

export interface StockLevel {
  id: string;
  lot_id: string;
  warehouse_id: string;
  qty_on_hand: number;
  qty_reserved: number;
  qty_shipped: number;
  updated_at: string;
}

export interface StockMovement {
  id: string;
  lot_id: string;
  warehouse_id: string;
  movement_type: StockMovementType;
  quantity: number;
  reference_type: string | null;
  reference_id: string | null;
  note: string | null;
  created_by: string | null;
  created_at: string;
}

export interface PurchaseInvoice {
  id: string;
  supplier_id: string;
  invoice_number: string;
  invoice_date: string | null;
  total_amount: number | null;
  currency: string;
  file_path: string | null;
  file_name: string | null;
  mime_type: string | null;
  extraction_status: PurchaseInvoiceExtractionStatus;
  extracted_data: Record<string, unknown>;
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface PurchaseInvoiceLine {
  id: string;
  purchase_invoice_id: string;
  product_reference_id: string | null;
  description: string;
  quantity: number;
  unit_price: number | null;
  lot_number: string | null;
  expiry_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface Recipient {
  id: string;
  supplier_id: string | null;
  name: string;
  type: RecipientType;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  postal_code: string | null;
  latitude: number | null;
  longitude: number | null;
  notes: string | null;
  active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface DeliverySchedule {
  id: string;
  supplier_id: string;
  warehouse_id: string;
  label: string | null;
  requested_date: string;
  status: DeliveryScheduleStatus;
  validated_at: string | null;
  validated_by: string | null;
  transmitted_at: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface DeliveryScheduleLine {
  id: string;
  delivery_schedule_id: string;
  recipient_id: string;
  product_reference_id: string;
  lot_id: string;
  quantity: number;
  unit: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface PreparationOrder {
  id: string;
  delivery_schedule_id: string;
  warehouse_id: string;
  status: PreparationOrderStatus;
  prepared_by: string | null;
  prepared_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface PreparationOrderLine {
  id: string;
  preparation_order_id: string;
  schedule_line_id: string;
  quantity_to_prepare: number;
  quantity_prepared: number;
  status: "pending" | "partial" | "prepared";
  created_at: string;
  updated_at: string;
}

export interface Delivery {
  id: string;
  delivery_schedule_id: string;
  recipient_id: string;
  shipment_id: string | null;
  status: DeliveryStatus;
  scheduled_at: string | null;
  delivered_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface DeliveryItem {
  id: string;
  delivery_id: string;
  schedule_line_id: string | null;
  lot_id: string;
  quantity: number;
  unit: string | null;
  created_at: string;
}

export interface Signature {
  id: string;
  delivery_id: string | null;
  shipment_id: string | null;
  proof_id: string | null;
  signer_name: string;
  signature_data: string;
  signature_hash: string;
  signed_at: string;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface DeliveryReminder {
  id: string;
  delivery_id: string;
  channel: "email" | "sms";
  target: "recipient" | "supplier" | "admin";
  scheduled_for: string;
  status: "pending" | "sent" | "failed";
  sent_at: string | null;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  address: string | null;
  role: AppRole;
  created_at: string;
  updated_at: string;
}

export interface Organization {
  id: string;
  name: string;
  kind: OrgKind;
  siret: string | null;
  address: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrganizationMember {
  organization_id: string;
  user_id: string;
  org_role: OrgRole;
  created_at: string;
}

export interface TransportRequest {
  id: string;
  client_id: string;
  organization_id: string | null;
  status: RequestStatus;
  service_type: ServiceType;
  pickup_address: string;
  dropoff_address: string;
  pickup_datetime: string;
  patient_name: string | null;
  mobility_notes: string | null;
  contact_phone: string | null;
  notes: string | null;
  content_type: ContentType;
  criticality: Criticality;
  sla_deadline: string | null;
  ischemia_deadline: string | null;
  temp_min: number | null;
  temp_max: number | null;
  created_at: string;
  updated_at: string;
}

export interface Quote {
  id: string;
  transport_request_id: string;
  version: number;
  status: QuoteStatus;
  amount: number;
  currency: string;
  valid_until: string | null;
  notes: string | null;
  created_by: string;
  sent_at: string | null;
  accepted_at: string | null;
  accepted_by: string | null;
  declined_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface QuoteLine {
  id: string;
  quote_id: string;
  position: number;
  description: string;
  quantity: number;
  unit_price: number;
  created_at: string;
  updated_at: string;
}

export interface DriverLocation {
  driver_id: string;
  lat: number;
  lng: number;
  accuracy: number | null;
  shared: boolean;
  created_at: string;
  updated_at: string;
}

export interface Shipment {
  id: string;
  transport_request_id: string | null;
  quote_id: string | null;
  mission_kind: MissionKind;
  delivery_schedule_id: string | null;
  warehouse_id: string | null;
  supplier_id: string | null;
  organization_id: string | null;
  status: ShipmentStatus;
  scheduled_at: string;
  confirmed_at: string | null;
  confirmed_by: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  notes: string | null;
  phase: MissionPhase;
  picked_up_at: string | null;
  delivered_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ShipmentEvent {
  id: string;
  shipment_id: string | null;
  transport_request_id: string | null;
  event_type: ShipmentEventType;
  payload: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
}

export interface Vehicle {
  id: string;
  organization_id: string | null;
  registration_plate: string;
  vehicle_type: VehicleType;
  vehicle_class: VehicleClass;
  label: string | null;
  capacity: number;
  has_wheelchair_lift: boolean;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DriverAssignment {
  id: string;
  shipment_id: string;
  driver_id: string;
  vehicle_id: string;
  status: AssignmentStatus;
  assigned_by: string | null;
  assigned_at: string;
  responded_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ContactMessage {
  id: string;
  topic: ContactTopic;
  full_name: string;
  email: string;
  phone: string | null;
  subject: string;
  message: string;
  handled: boolean;
  partner_id: string | null;
  created_at: string;
}

export interface SiteSettings {
  id: number;
  logo_url: string | null;
  logo_alt: string | null;
  slogan: string | null;
  custom_css: string | null;
  social_facebook: string | null;
  social_linkedin: string | null;
  social_x: string | null;
  social_instagram: string | null;
  newsletter_url: string | null;
  home_hero_image: string | null;
  home_visual_image: string | null;
  updated_by: string | null;
  updated_at: string;
}

export type InvoiceStatus = "issued" | "sent" | "paid" | "cancelled";

export interface Invoice {
  id: string;
  quote_id: string;
  invoice_number: string | null;
  client_id: string;
  amount: number;
  currency: string;
  vat_rate: number;
  status: InvoiceStatus;
  issued_at: string;
  due_at: string | null;
  paid_at: string | null;
  notes: string | null;
  created_at: string;
  stripe_session_id: string | null;
}

export interface InternalMessage {
  id: string;
  sender_id: string;
  recipient_id: string;
  body: string;
  read_at: string | null;
  created_at: string;
}

export interface CrmNote {
  id: string;
  client_id: string;
  author_id: string | null;
  kind: "note" | "call" | "email";
  body: string;
  created_at: string;
}

export interface EmailLog {
  id: string;
  recipient_id: string | null;
  to_email: string;
  subject: string;
  template: string | null;
  provider: string | null;
  status: "sent" | "failed" | "queued";
  error: string | null;
  created_at: string;
}

export interface AppSettingsRow {
  id: number;
  smtp_host: string | null;
  smtp_port: number | null;
  smtp_user: string | null;
  smtp_pass: string | null;
  smtp_from: string | null;
  resend_api_key: string | null;
  twilio_account_sid: string | null;
  twilio_auth_token: string | null;
  twilio_from: string | null;
  stripe_secret_key: string | null;
  vat_rate: number;
  docusign_account_id: string | null;
  docusign_integration_key: string | null;
  docusign_user_id: string | null;
  docusign_private_key: string | null;
  docusign_environment: string;
  updated_by: string | null;
  updated_at: string;
}

export interface RequestAttachment {
  id: string;
  request_id: string;
  storage_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number | null;
  uploaded_by: string | null;
  created_at: string;
}

export interface VerificationCode {
  id: string;
  user_id: string;
  channel: "email" | "sms";
  code_hash: string;
  expires_at: string;
  attempts: number;
  consumed_at: string | null;
  created_at: string;
}

export interface AppNotification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  url: string | null;
  tag: string | null;
  data: Record<string, unknown> | null;
  read_at: string | null;
  created_at: string;
}

type Row<T> = T;
type Insert<T> = Partial<T>;
type Update<T> = Partial<T>;

export interface Database {
  public: {
    Tables: {
      profiles: { Row: Row<Profile>; Insert: Insert<Profile>; Update: Update<Profile> };
      shipment_temperature: { Row: { id: number; shipment_id: string; temperature: number; recorded_at: string }; Insert: { shipment_id: string; temperature: number }; Update: { temperature?: number } };
      organizations: { Row: Row<Organization>; Insert: Insert<Organization>; Update: Update<Organization> };
      organization_members: {
        Row: Row<OrganizationMember>;
        Insert: Insert<OrganizationMember>;
        Update: Update<OrganizationMember>;
      };
      transport_requests: {
        Row: Row<TransportRequest>;
        Insert: Insert<TransportRequest>;
        Update: Update<TransportRequest>;
      };
      quotes: { Row: Row<Quote>; Insert: Insert<Quote>; Update: Update<Quote> };
      shipments: { Row: Row<Shipment>; Insert: Insert<Shipment>; Update: Update<Shipment> };
      shipment_events: {
        Row: Row<ShipmentEvent>;
        Insert: Insert<ShipmentEvent>;
        Update: Update<ShipmentEvent>;
      };
      vehicles: { Row: Row<Vehicle>; Insert: Insert<Vehicle>; Update: Update<Vehicle> };
      driver_assignments: {
        Row: Row<DriverAssignment>;
        Insert: Insert<DriverAssignment>;
        Update: Update<DriverAssignment>;
      };
      contact_messages: {
        Row: Row<ContactMessage>;
        Insert: Insert<ContactMessage>;
        Update: Update<ContactMessage>;
      };
      delivery_proofs: {
        Row: Row<DeliveryProof>;
        Insert: Insert<DeliveryProof>;
        Update: Update<DeliveryProof>;
      };
      esign_documents: {
        Row: Row<EsignDocument>;
        Insert: Insert<EsignDocument>;
        Update: Update<EsignDocument>;
      };
      site_settings: {
        Row: Row<SiteSettings>;
        Insert: Insert<SiteSettings>;
        Update: Update<SiteSettings>;
      };
      internal_messages: {
        Row: Row<InternalMessage>;
        Insert: Insert<InternalMessage>;
        Update: Update<InternalMessage>;
      };
      crm_notes: {
        Row: Row<CrmNote>;
        Insert: Insert<CrmNote>;
        Update: Update<CrmNote>;
      };
      email_log: {
        Row: Row<EmailLog>;
        Insert: Insert<EmailLog>;
        Update: Update<EmailLog>;
      };
      invoices: {
        Row: Row<Invoice>;
        Insert: Insert<Invoice>;
        Update: Update<Invoice>;
      };
      app_settings: {
        Row: Row<AppSettingsRow>;
        Insert: Insert<AppSettingsRow>;
        Update: Update<AppSettingsRow>;
      };
      verification_codes: {
        Row: Row<VerificationCode>;
        Insert: Insert<VerificationCode>;
        Update: Update<VerificationCode>;
      };
      notifications: {
        Row: Row<AppNotification>;
        Insert: Insert<AppNotification>;
        Update: Update<AppNotification>;
      };
      suppliers: { Row: Row<Supplier>; Insert: Insert<Supplier>; Update: Update<Supplier> };
      warehouses: { Row: Row<Warehouse>; Insert: Insert<Warehouse>; Update: Update<Warehouse> };
      products: { Row: Row<Product>; Insert: Insert<Product>; Update: Update<Product> };
      product_references: {
        Row: Row<ProductReference>;
        Insert: Insert<ProductReference>;
        Update: Update<ProductReference>;
      };
      lots: { Row: Row<Lot>; Insert: Insert<Lot>; Update: Update<Lot> };
      stock_levels: { Row: Row<StockLevel>; Insert: Insert<StockLevel>; Update: Update<StockLevel> };
      stock_movements: {
        Row: Row<StockMovement>;
        Insert: Insert<StockMovement>;
        Update: Update<StockMovement>;
      };
      purchase_invoices: {
        Row: Row<PurchaseInvoice>;
        Insert: Insert<PurchaseInvoice>;
        Update: Update<PurchaseInvoice>;
      };
      purchase_invoice_lines: {
        Row: Row<PurchaseInvoiceLine>;
        Insert: Insert<PurchaseInvoiceLine>;
        Update: Update<PurchaseInvoiceLine>;
      };
      recipients: { Row: Row<Recipient>; Insert: Insert<Recipient>; Update: Update<Recipient> };
      delivery_schedules: {
        Row: Row<DeliverySchedule>;
        Insert: Insert<DeliverySchedule>;
        Update: Update<DeliverySchedule>;
      };
      delivery_schedule_lines: {
        Row: Row<DeliveryScheduleLine>;
        Insert: Insert<DeliveryScheduleLine>;
        Update: Update<DeliveryScheduleLine>;
      };
      preparation_orders: {
        Row: Row<PreparationOrder>;
        Insert: Insert<PreparationOrder>;
        Update: Update<PreparationOrder>;
      };
      preparation_order_lines: {
        Row: Row<PreparationOrderLine>;
        Insert: Insert<PreparationOrderLine>;
        Update: Update<PreparationOrderLine>;
      };
      deliveries: { Row: Row<Delivery>; Insert: Insert<Delivery>; Update: Update<Delivery> };
      delivery_items: {
        Row: Row<DeliveryItem>;
        Insert: Insert<DeliveryItem>;
        Update: Update<DeliveryItem>;
      };
      signatures: { Row: Row<Signature>; Insert: Insert<Signature>; Update: Update<Signature> };
      delivery_reminders: {
        Row: Row<DeliveryReminder>;
        Insert: Insert<DeliveryReminder>;
        Update: Update<DeliveryReminder>;
      };
    };
    Functions: {
      create_quote: {
        Args: {
          p_transport_request_id: string;
          p_amount: number;
          p_valid_until?: string | null;
          p_notes?: string | null;
        };
        Returns: Quote;
      };
      send_quote: { Args: { p_quote_id: string }; Returns: Quote };
      accept_quote: { Args: { p_quote_id: string }; Returns: Shipment };
      decline_quote: { Args: { p_quote_id: string }; Returns: Quote };
      mark_request_under_review: { Args: { p_request_id: string }; Returns: TransportRequest };
      reject_request: { Args: { p_request_id: string; p_reason?: string | null }; Returns: TransportRequest };
      cancel_transport_request: {
        Args: { p_request_id: string; p_reason?: string | null };
        Returns: TransportRequest;
      };
      confirm_shipment: { Args: { p_shipment_id: string }; Returns: Shipment };
      start_shipment: { Args: { p_shipment_id: string }; Returns: Shipment };
      complete_shipment: { Args: { p_shipment_id: string }; Returns: Shipment };
      cancel_shipment: { Args: { p_shipment_id: string; p_reason?: string | null }; Returns: Shipment };
      assign_driver: {
        Args: { p_shipment_id: string; p_driver_id: string; p_vehicle_id: string };
        Returns: DriverAssignment;
      };
      respond_driver_assignment: {
        Args: { p_assignment_id: string; p_accept: boolean };
        Returns: DriverAssignment;
      };
      set_user_role: { Args: { p_user_id: string; p_role: AppRole }; Returns: Profile };
      bootstrap_first_admin: { Args: { p_email: string }; Returns: Profile };
      is_admin: { Args: Record<string, never>; Returns: boolean };
      is_staff: { Args: Record<string, never>; Returns: boolean };
      is_driver: { Args: Record<string, never>; Returns: boolean };
      share_driver_position: {
        Args: {
          p_lat: number;
          p_lng: number;
          p_accuracy?: number | null;
          p_shared?: boolean;
        };
        Returns: DriverLocation;
      };
      shipment_driver_position: {
        Args: { p_shipment_id: string };
        Returns: Array<{
          lat: number | null;
          lng: number | null;
          accuracy: number | null;
          shared: boolean;
          updated_at: string | null;
        }>;
      };
      admin_update_profile: {
        Args: { p_user_id: string; p_full_name?: string | null; p_phone?: string | null; p_address?: string | null; p_avatar_url?: string | null; p_role?: AppRole | null };
        Returns: Profile;
      };
      update_own_profile: {
        Args: { p_full_name?: string | null; p_phone?: string | null; p_address?: string | null; p_avatar_url?: string | null };
        Returns: Profile;
      };
      shipment_track: {
        Args: { p_shipment_id: string; p_hours_before?: number };
        Returns: Array<{
          lat: number;
          lng: number;
          recorded_at: string;
        }>;
      };
      advance_mission_phase: { Args: { p_shipment_id: string; p_phase: MissionPhase }; Returns: Shipment };
      create_invoice_from_quote: { Args: { p_quote_id: string }; Returns: Invoice };
      create_delivery_schedule: {
        Args: {
          p_supplier_id: string;
          p_warehouse_id: string;
          p_requested_date: string;
          p_label?: string | null;
          p_notes?: string | null;
        };
        Returns: DeliverySchedule;
      };
      add_delivery_schedule_line: {
        Args: {
          p_schedule_id: string;
          p_recipient_id: string;
          p_lot_id: string;
          p_quantity: number;
          p_unit?: string | null;
          p_notes?: string | null;
        };
        Returns: DeliveryScheduleLine;
      };
      update_delivery_schedule: {
        Args: {
          p_schedule_id: string;
          p_label?: string | null;
          p_notes?: string | null;
          p_requested_date?: string | null;
          p_warehouse_id?: string | null;
        };
        Returns: DeliverySchedule;
      };
      delete_delivery_schedule: { Args: { p_schedule_id: string }; Returns: DeliverySchedule };
      remove_delivery_schedule_line: { Args: { p_line_id: string }; Returns: DeliveryScheduleLine };
      validate_delivery_schedule: { Args: { p_schedule_id: string }; Returns: DeliverySchedule };
      transmit_delivery_schedule: { Args: { p_schedule_id: string }; Returns: DeliverySchedule };
      cancel_delivery_schedule: { Args: { p_schedule_id: string }; Returns: DeliverySchedule };
      receive_stock: {
        Args: {
          p_supplier_id: string;
          p_warehouse_id: string;
          p_product_reference_id: string;
          p_lot_number: string;
          p_quantity: number;
          p_expiry_date?: string | null;
          p_reference_type?: string | null;
          p_reference_id?: string | null;
          p_note?: string | null;
        };
        Returns: StockLevel;
      };
      schedule_delivery_reminders: {
        Args: { p_delivery_id: string };
        Returns: DeliveryReminder[];
      };
      assign_delivery_mission: {
        Args: { p_delivery_id: string; p_driver_id: string; p_vehicle_id: string };
        Returns: DriverAssignment;
      };
      confirm_delivery_with_proof: {
        Args: {
          p_delivery_id: string;
          p_recipient_name: string;
          p_signature_data: string;
          p_note?: string | null;
          p_latitude?: number | null;
          p_longitude?: number | null;
        };
        Returns: Delivery;
      };
      set_preparation_order_status: {
        Args: {
          p_order_id: string;
          p_status: PreparationOrderStatus;
          p_note?: string | null;
        };
        Returns: PreparationOrder;
      };
      record_preparation_progress: {
        Args: { p_line_id: string; p_quantity_prepared: number };
        Returns: PreparationOrderLine;
      };
      admin_create_supplier: {
        Args: {
          p_organization_name: string;
          p_code: string;
          p_contact_email?: string | null;
          p_contact_phone?: string | null;
          p_siret?: string | null;
          p_address?: string | null;
        };
        Returns: Supplier;
      };
      admin_attach_supplier_member: {
        Args: { p_supplier_id: string; p_user_id: string; p_org_role?: OrgRole };
        Returns: OrganizationMember;
      };
    };
    Views: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
