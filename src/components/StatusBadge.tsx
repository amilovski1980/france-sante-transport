"use client";

import { useI18n } from "@/components/I18nProvider";
import type {
  AssignmentStatus,
  QuoteStatus,
  RequestStatus,
  ShipmentStatus,
} from "@/lib/types";

type Tone = "navy" | "red" | "green" | "amber" | "slate";

const REQUEST_TONES: Record<RequestStatus, Tone> = {
  draft: "slate",
  submitted: "navy",
  under_review: "amber",
  quoted: "navy",
  accepted: "green",
  rejected: "red",
  cancelled: "slate",
  completed: "green",
};

const QUOTE_TONES: Record<QuoteStatus, Tone> = {
  draft: "slate",
  sent: "navy",
  accepted: "green",
  declined: "red",
  expired: "slate",
  superseded: "slate",
};

const SHIPMENT_TONES: Record<ShipmentStatus, Tone> = {
  pending_confirmation: "amber",
  confirmed: "green",
  in_progress: "navy",
  completed: "green",
  cancelled: "red",
};

const ASSIGNMENT_TONES: Record<AssignmentStatus, Tone> = {
  proposed: "amber",
  accepted: "green",
  declined: "red",
  completed: "green",
  cancelled: "slate",
};

const TONE_CLASSES: Record<Tone, string> = {
  navy: "bg-navy-50 text-navy-700 border-navy-200",
  red: "bg-flagred-50 text-flagred-700 border-flagred-600/30",
  green: "bg-emerald-50 text-emerald-800 border-emerald-200",
  amber: "bg-amber-50 text-amber-800 border-amber-200",
  slate: "bg-slate-100 text-slate-600 border-slate-200",
};

export function RequestStatusBadge({ status }: { status: RequestStatus }) {
  const { labels } = useI18n();
  return <Badge tone={REQUEST_TONES[status]} label={labels.request[status]} />;
}

export function QuoteStatusBadge({ status }: { status: QuoteStatus }) {
  const { labels } = useI18n();
  return <Badge tone={QUOTE_TONES[status]} label={labels.quote[status]} />;
}

export function ShipmentStatusBadge({ status }: { status: ShipmentStatus }) {
  const { labels } = useI18n();
  return <Badge tone={SHIPMENT_TONES[status]} label={labels.shipment[status]} />;
}

export function AssignmentStatusBadge({ status }: { status: AssignmentStatus }) {
  const { labels } = useI18n();
  return <Badge tone={ASSIGNMENT_TONES[status]} label={labels.assignment[status]} />;
}

export function Badge({ tone, label }: { tone: Tone; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${TONE_CLASSES[tone]}`}
    >
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {label}
    </span>
  );
}
