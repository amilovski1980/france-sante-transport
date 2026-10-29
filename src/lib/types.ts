export type AppRole = "client" | "admin" | "dispatcher" | "driver" | "partner";
export type OrgKind = "client_company" | "facility" | "partner";
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
  | "note";
export type VehicleType = "sedan" | "van" | "minibus" | "stretcher_van" | "ambulance";
export type AssignmentStatus = "proposed" | "accepted" | "declined" | "completed" | "cancelled";
export type ContactTopic = "contact" | "referral" | "quote_request" | "other";

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
  transport_request_id: string;
  quote_id: string;
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
  created_at: string;
}

export interface SiteSettings {
  id: number;
  logo_url: string | null;
  logo_alt: string | null;
  slogan: string | null;
  custom_css: string | null;
  updated_by: string | null;
  updated_at: string;
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
      site_settings: {
        Row: Row<SiteSettings>;
        Insert: Insert<SiteSettings>;
        Update: Update<SiteSettings>;
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
    };
    Views: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
