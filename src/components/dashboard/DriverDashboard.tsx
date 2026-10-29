"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { respondToAssignment } from "@/lib/api";
import { toUserMessage } from "@/lib/errors";
import { useLiveRefresh } from "@/lib/useLiveRefresh";
import { useI18n } from "@/components/I18nProvider";
import { AssignmentStatusBadge, ShipmentStatusBadge } from "@/components/StatusBadge";
import { formatDateTime } from "@/components/dashboard/ClientDashboard";
import ProfileEditor from "@/components/dashboard/ProfileEditor";
import PositionShareToggle from "@/components/dashboard/PositionShareToggle";
import type { DriverAssignment, Shipment, TransportRequest, Vehicle } from "@/lib/types";

export default function DriverDashboard({
  assignments,
  shipments,
  requests,
  vehicles,
}: {
  assignments: DriverAssignment[];
  shipments: Shipment[];
  requests: TransportRequest[];
  vehicles: Vehicle[];
}) {
  const { t, labels, locale } = useI18n();
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { mode } = useLiveRefresh(["driver_assignments", "shipments"]);

  async function respond(id: string, accept: boolean) {
    setPendingId(id);
    setError(null);
    try {
      await respondToAssignment(id, accept);
      router.refresh();
    } catch (err) {
      setError(toUserMessage(err));
    } finally {
      setPendingId(null);
    }
  }

  if (assignments.length === 0) {
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-2 text-xs text-navy-500">
          <span
            className={`h-2 w-2 rounded-full ${
              mode === "realtime"
                ? "animate-pulse bg-emerald-500"
                : mode === "connecting"
                  ? "animate-pulse bg-navy-400"
                  : "bg-amber-500"
            }`}
          />
          {mode === "realtime"
            ? t("dd.liveNew")
            : mode === "connecting"
              ? t("dlb.connecting")
              : t("dlb.polling")}
        </div>
        <PositionShareToggle />
        <div className="surface mx-auto max-w-2xl p-10 text-center">
          <h2 className="font-display text-2xl font-semibold text-navy-900">{t("dd.emptyTitle")}</h2>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-navy-700/80">
            {t("dd.emptyBody")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 text-xs text-navy-500">
        <span
          className={`h-2 w-2 rounded-full ${
            mode === "realtime"
              ? "animate-pulse bg-emerald-500"
              : mode === "connecting"
                ? "animate-pulse bg-navy-400"
                : "bg-amber-500"
          }`}
        />
        {mode === "realtime"
          ? t("dd.updates")
          : mode === "connecting"
            ? t("dlb.connecting")
            : t("dlb.polling")}
      </div>
      <PositionShareToggle />
      {error && (
        <p role="alert" className="rounded-lg border border-flagred-600/30 bg-flagred-50 px-4 py-3 text-sm font-medium text-flagred-700">
          {error}
        </p>
      )}

      {assignments.map((assignment) => {
        const shipment = shipments.find((s) => s.id === assignment.shipment_id);
        const request = shipment
          ? requests.find((r) => r.id === shipment.transport_request_id)
          : undefined;
        const vehicle = vehicles.find((v) => v.id === assignment.vehicle_id);

        return (
          <article key={assignment.id} className="surface overflow-hidden">
            <div className="flex flex-col gap-3 border-b border-navy-100 bg-navy-50/50 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h3 className="font-semibold text-navy-900">
                    {t("dd.missionOn", {
                      t: formatDateTime(
                        shipment?.scheduled_at ?? assignment.assigned_at,
                        locale,
                      ),
                    })}
                  </h3>
                  <AssignmentStatusBadge status={assignment.status} />
                  {shipment && <ShipmentStatusBadge status={shipment.status} />}
                </div>
                <p className="mt-1 text-sm text-navy-700/80">
                  {request
                    ? `${labels.service[request.service_type]} · ${request.pickup_address} → ${request.dropoff_address}`
                    : t("dd.pendingDetails")}
                </p>
                <p className="mt-0.5 text-xs text-navy-500">
                  {t("dd.assignedOn", { t: formatDateTime(assignment.assigned_at, locale) })}
                  {vehicle ? ` · ${vehicle.registration_plate} (${vehicle.vehicle_type})` : ""}
                </p>
              </div>

              {assignment.status === "proposed" && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={pendingId === assignment.id}
                    onClick={() => respond(assignment.id, true)}
                    className="rounded-full bg-navy-800 px-5 py-2 text-xs font-semibold text-white hover:bg-navy-700 disabled:opacity-60"
                  >
                    {pendingId === assignment.id ? t("dd.processing") : t("dd.acceptMission")}
                  </button>
                  <button
                    type="button"
                    disabled={pendingId === assignment.id}
                    onClick={() => respond(assignment.id, false)}
                    className="rounded-full border border-navy-200 px-5 py-2 text-xs font-semibold text-navy-700 hover:bg-navy-50 disabled:opacity-60"
                  >
                    {t("dd.decline")}
                  </button>
                </div>
              )}
            </div>

            <div className="grid gap-4 p-5 text-sm sm:grid-cols-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-navy-500">{t("dd.pickup")}</p>
                <p className="mt-1 text-navy-800">{request?.pickup_address ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-navy-500">{t("dd.dropoff")}</p>
                <p className="mt-1 text-navy-800">{request?.dropoff_address ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-navy-500">
                  {t("dd.patientNotes")}
                </p>
                <p className="mt-1 text-navy-800">
                  {request?.patient_name || request?.mobility_notes || "—"}
                </p>
              </div>
              <p className="text-xs text-navy-500 sm:col-span-3">
                {t("dd.assignmentState")} {labels.assignment[assignment.status]}
                {assignment.responded_at
                  ? t("dd.respondedOn", {
                      t: formatDateTime(assignment.responded_at, locale),
                    })
                  : ""}
              </p>
            </div>
          </article>
        );
      })}

      <ProfileEditor />
    </div>
  );
}
