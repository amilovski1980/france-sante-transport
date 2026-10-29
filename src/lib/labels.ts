import type {
  AssignmentStatus,
  QuoteStatus,
  RequestStatus,
  ServiceType,
  ShipmentEventType,
  ShipmentStatus,
} from "@/lib/types";

export const REQUEST_STATUS_LABELS: Record<RequestStatus, string> = {
  draft: "Brouillon",
  submitted: "Soumise",
  under_review: "En instruction",
  quoted: "Devis envoyé",
  accepted: "Acceptée",
  rejected: "Refusée",
  cancelled: "Annulée",
  completed: "Terminée",
};

export const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  draft: "Brouillon",
  sent: "Envoyée",
  accepted: "Acceptée",
  declined: "Refusée",
  expired: "Expirée",
  superseded: "Remplacée",
};

export const SHIPMENT_STATUS_LABELS: Record<ShipmentStatus, string> = {
  pending_confirmation: "À confirmer",
  confirmed: "Confirmée",
  in_progress: "En cours",
  completed: "Terminée",
  cancelled: "Annulée",
};

export const ASSIGNMENT_STATUS_LABELS: Record<AssignmentStatus, string> = {
  proposed: "Proposée",
  accepted: "Acceptée",
  declined: "Refusée",
  completed: "Terminée",
  cancelled: "Annulée",
};

export const SERVICE_TYPE_LABELS: Record<ServiceType, string> = {
  medical_transport: "Transport médicalisé",
  wheelchair_transport: "Transport en fauteuil",
  stretcher_transport: "Transport en brancard",
  appointment_transfer: "Transport vers rendez-vous",
  medical_supply: "Transport de matériel médical",
  other: "Autre besoin",
};

export const EVENT_TYPE_LABELS: Record<ShipmentEventType, string> = {
  request_submitted: "Demande soumise",
  request_under_review: "Mise en instruction",
  request_rejected: "Demande refusée",
  request_cancelled: "Demande annulée",
  quote_created: "Devis préparé",
  quote_sent: "Devis envoyé",
  quote_accepted: "Devis accepté",
  quote_declined: "Devis refusé",
  quote_cancelled: "Devis annulé",
  mission_created: "Mission créée",
  mission_confirmed: "Mission confirmée",
  mission_in_progress: "Mission démarrée",
  mission_completed: "Mission terminée",
  mission_cancelled: "Mission annulée",
  driver_assigned: "Chauffeur affecté",
  driver_response: "Réponse du chauffeur",
  note: "Note interne",
};

export const ASSIGNABLE_ROLES = [
  { value: "driver", label: "Chauffeur" },
  { value: "dispatcher", label: "Dispatcheur" },
  { value: "client", label: "Client" },
] as const;

// ------------------------------------------------------------
// Localisation des libellés (FR + EN)
// ------------------------------------------------------------

export const REQUEST_STATUS_LABELS_EN: Record<RequestStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  under_review: "Under review",
  quoted: "Quote sent",
  accepted: "Accepted",
  rejected: "Declined",
  cancelled: "Cancelled",
  completed: "Completed",
};

export const QUOTE_STATUS_LABELS_EN: Record<QuoteStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  accepted: "Accepted",
  declined: "Declined",
  expired: "Expired",
  superseded: "Superseded",
};

export const SHIPMENT_STATUS_LABELS_EN: Record<ShipmentStatus, string> = {
  pending_confirmation: "To confirm",
  confirmed: "Confirmed",
  in_progress: "In progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const ASSIGNMENT_STATUS_LABELS_EN: Record<AssignmentStatus, string> = {
  proposed: "Proposed",
  accepted: "Accepted",
  declined: "Declined",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const SERVICE_TYPE_LABELS_EN: Record<ServiceType, string> = {
  medical_transport: "Assisted medical transport",
  wheelchair_transport: "Wheelchair transport",
  stretcher_transport: "Stretcher transport",
  appointment_transfer: "Appointment transfer",
  medical_supply: "Medical equipment transport",
  other: "Other need",
};

export const EVENT_TYPE_LABELS_EN: Record<ShipmentEventType, string> = {
  request_submitted: "Request submitted",
  request_under_review: "Request under review",
  request_rejected: "Request declined",
  request_cancelled: "Request cancelled",
  quote_created: "Quote drafted",
  quote_sent: "Quote sent",
  quote_accepted: "Quote accepted",
  quote_declined: "Quote declined",
  quote_cancelled: "Quote cancelled",
  mission_created: "Mission created",
  mission_confirmed: "Mission confirmed",
  mission_in_progress: "Mission started",
  mission_completed: "Mission completed",
  mission_cancelled: "Mission cancelled",
  driver_assigned: "Driver assigned",
  driver_response: "Driver response",
  note: "Internal note",
};

export const ASSIGNABLE_ROLES_EN = [
  { value: "driver", label: "Driver" },
  { value: "dispatcher", label: "Dispatcher" },
  { value: "client", label: "Client" },
] as const;

export interface Labels {
  request: Record<RequestStatus, string>;
  quote: Record<QuoteStatus, string>;
  shipment: Record<ShipmentStatus, string>;
  assignment: Record<AssignmentStatus, string>;
  service: Record<ServiceType, string>;
  event: Record<ShipmentEventType, string>;
  roles: readonly { value: string; label: string }[];
}

export function getLabels(locale: string): Labels {
  const en = locale === "en";
  return {
    request: en ? REQUEST_STATUS_LABELS_EN : REQUEST_STATUS_LABELS,
    quote: en ? QUOTE_STATUS_LABELS_EN : QUOTE_STATUS_LABELS,
    shipment: en ? SHIPMENT_STATUS_LABELS_EN : SHIPMENT_STATUS_LABELS,
    assignment: en ? ASSIGNMENT_STATUS_LABELS_EN : ASSIGNMENT_STATUS_LABELS,
    service: en ? SERVICE_TYPE_LABELS_EN : SERVICE_TYPE_LABELS,
    event: en ? EVENT_TYPE_LABELS_EN : EVENT_TYPE_LABELS,
    roles: en ? ASSIGNABLE_ROLES_EN : ASSIGNABLE_ROLES,
  };
}
