"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { acceptQuote, cancelMyRequest, declineQuote } from "@/lib/api";
import { toUserMessage } from "@/lib/errors";
import { QuoteStatusBadge, RequestStatusBadge, ShipmentStatusBadge } from "@/components/StatusBadge";
import ProfileEditor from "@/components/dashboard/ProfileEditor";
import QuoteLines from "@/components/dashboard/QuoteLines";
import ClientTrackingMap from "@/components/dashboard/ClientTrackingMap";
import { useI18n } from "@/components/I18nProvider";
import type { Quote, Shipment, ShipmentEvent, TransportRequest } from "@/lib/types";

const CANCELABLE: TransportRequest["status"][] = [
  "draft",
  "submitted",
  "under_review",
  "quoted",
  "accepted",
  "rejected",
];

export function formatMoney(amount: number, currency = "EUR", locale = "fr-FR") {
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(amount);
}

export function formatDateTime(value: string | null | undefined, locale = "fr-FR") {
  if (!value) return "—";
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

interface ActionState {
  pendingId: string | null;
  error: string | null;
}

export default function ClientDashboard({
  requests,
  quotes,
  events,
  shipments,
}: {
  requests: TransportRequest[];
  quotes: Quote[];
  events: ShipmentEvent[];
  shipments: Shipment[];
}) {
  const { t, labels, locale } = useI18n();
  const router = useRouter();
  const [state, setState] = useState<ActionState>({ pendingId: null, error: null });

  async function run(id: string, action: () => Promise<unknown>) {
    setState({ pendingId: id, error: null });
    try {
      await action();
      router.refresh();
    } catch (error) {
      setState({ pendingId: null, error: toUserMessage(error) });
      return;
    }
    setState({ pendingId: null, error: null });
  }

  if (requests.length === 0) {
    return (
      <div className="surface mx-auto max-w-2xl p-10 text-center">
        <h2 className="font-display text-2xl font-semibold text-navy-900">{t("cd.emptyTitle")}</h2>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-navy-700/80">
          {t("cd.emptyBody")}
        </p>
        <Link
          href="/devis"
          className="mt-7 inline-flex rounded-full bg-flagred-600 px-7 py-3 text-sm font-semibold text-white hover:bg-flagred-700"
        >
          {t("cd.requestQuote")}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {state.error && (
        <p role="alert" className="rounded-lg border border-flagred-600/30 bg-flagred-50 px-4 py-3 text-sm font-medium text-flagred-700">
          {state.error}
        </p>
      )}

      {requests.map((request) => {
        const requestQuotes = quotes
          .filter((q) => q.transport_request_id === request.id)
          .sort((a, b) => b.version - a.version);
        const requestShipments = shipments.filter((s) => s.transport_request_id === request.id);
        const shipmentIds = new Set(requestShipments.map((s) => s.id));
        const requestEvents = events
          .filter(
            (e) =>
              e.transport_request_id === request.id ||
              (e.shipment_id !== null && shipmentIds.has(e.shipment_id)),
          )
          .sort((a, b) => a.created_at.localeCompare(b.created_at));
        const latestSent = requestQuotes.find((q) => q.status === "sent");

        return (
          <article key={request.id} className="surface overflow-hidden">
            <div className="flex flex-col gap-4 border-b border-navy-100 bg-navy-50/50 p-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="font-display text-lg font-semibold text-navy-900">
                    {labels.service[request.service_type]}
                  </h2>
                  <RequestStatusBadge status={request.status} />
                </div>
                <p className="mt-1.5 text-sm text-navy-700/80">
                  {request.pickup_address} → {request.dropoff_address}
                </p>
                <p className="mt-1 text-xs text-navy-500">
                  {t("cd.pickupOn", {
                    pickup: formatDateTime(request.pickup_datetime, locale),
                    created: formatDateTime(request.created_at, locale),
                  })}
                </p>
              </div>
              {CANCELABLE.includes(request.status) && (
                <button
                  type="button"
                  disabled={state.pendingId === request.id}
                  onClick={() =>
                    run(request.id, () => cancelMyRequest(request.id, "Annulation demandée par le client"))
                  }
                  className="rounded-full border border-navy-200 px-5 py-2 text-xs font-semibold text-navy-700 hover:bg-white disabled:opacity-60"
                >
                  {state.pendingId === request.id ? t("cd.cancelAction") : t("cd.cancelRequest")}
                </button>
              )}
            </div>

            <div className="grid gap-6 p-6 lg:grid-cols-2">
              {/* Devis */}
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-widest text-navy-500">
                  {t("cd.quotesReceived")}
                </h3>
                {requestQuotes.length === 0 ? (
                  <p className="mt-3 text-sm text-navy-600">
                    {t("cd.noQuotes")}
                  </p>
                ) : (
                  <ul className="mt-3 space-y-3">
                    {requestQuotes.map((quote) => {
                      const isPendingAction = state.pendingId === quote.id;
                      return (
                        <li
                          key={quote.id}
                          className="rounded-xl border border-navy-100 bg-white p-4 shadow-sm"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <p className="font-semibold text-navy-900">
                                {t("cd.version", { v: quote.version })} ·{" "}
                                <span className="text-navy-700">{formatMoney(quote.amount, quote.currency, locale)}</span>
                              </p>
                              <p className="mt-0.5 text-xs text-navy-500">
                                {quote.sent_at
                                  ? t("cd.sentOn", { t: formatDateTime(quote.sent_at, locale) })
                                  : t("cd.internalDraft")}
                                {quote.valid_until
                                  ? t("cd.validUntil", {
                                      t: formatDateTime(quote.valid_until, locale),
                                    })
                                  : ""}
                              </p>
                            </div>
                            <QuoteStatusBadge status={quote.status} />
                          </div>

                          {quote.notes && (
                            <p className="mt-3 rounded-lg bg-navy-50 px-3 py-2 text-xs leading-relaxed text-navy-700">
                              {quote.notes}
                            </p>
                          )}

                          <div className="mt-3">
                            <QuoteLines quoteId={quote.id} currency={quote.currency} />
                          </div>

                          <p className="mt-2">
                            <a
                              href={`/dashboard/devis/${quote.id}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs font-semibold text-navy-700 underline decoration-navy-300 underline-offset-2 hover:text-navy-900"
                            >
                              {t("cd.viewPrint")}
                            </a>
                          </p>

                          {quote.status === "sent" && (
                            <div className="mt-4 flex flex-wrap gap-2">
                              <button
                                type="button"
                                disabled={isPendingAction}
                                onClick={() => run(quote.id, () => acceptQuote(quote.id))}
                                className="rounded-full bg-navy-800 px-5 py-2 text-xs font-semibold text-white hover:bg-navy-700 disabled:opacity-60"
                              >
                                {isPendingAction ? t("cd.processing") : t("cd.acceptQuote")}
                              </button>
                              <button
                                type="button"
                                disabled={isPendingAction}
                                onClick={() => run(quote.id, () => declineQuote(quote.id))}
                                className="rounded-full border border-navy-200 px-5 py-2 text-xs font-semibold text-navy-700 hover:bg-navy-50 disabled:opacity-60"
                              >
                                {t("cd.decline")}
                              </button>
                            </div>
                          )}
                          {quote.status === "accepted" && quote.accepted_at && (
                            <p className="mt-3 text-xs font-semibold text-emerald-700">
                              {t("cd.acceptedOn", {
                                t: formatDateTime(quote.accepted_at, locale),
                              })}
                            </p>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}

                {latestSent && (
                  <p className="mt-3 text-xs text-navy-500">
                    {t("cd.versionNote")}
                  </p>
                )}
              </div>

              {/* Suivi */}
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-widest text-navy-500">
                  {t("cd.trackingTitle")}
                </h3>

                {requestShipments.length > 0 && (
                  <ul className="mt-3 space-y-3">
                    {requestShipments.map((shipment) => (
                      <li
                        key={shipment.id}
                        className="rounded-xl border border-navy-100 bg-white p-4 shadow-sm"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <p className="text-sm font-semibold text-navy-900">
                            {t("cd.missionOn", {
                              t: formatDateTime(shipment.scheduled_at, locale),
                            })}
                          </p>
                          <ShipmentStatusBadge status={shipment.status} />
                        </div>
                        <p className="mt-1 text-xs text-navy-500">
                          {shipment.status === "pending_confirmation"
                            ? t("cd.pendingConfirm")
                            : shipment.status === "confirmed"
                              ? t("cd.confirmed")
                              : t("cd.tracking")}
                        </p>
                        {(shipment.status === "confirmed" || shipment.status === "in_progress") && (
                          <div className="mt-3">
                            <ClientTrackingMap
                              shipmentId={shipment.id}
                              pickupAddress={request.pickup_address}
                              dropoffAddress={request.dropoff_address}
                            />
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}

                <ol className="mt-4 space-y-3 border-l-2 border-navy-100 pl-5">
                  {requestEvents.length === 0 && (
                    <li className="text-sm text-navy-600">{t("cd.noEvents")}</li>
                  )}
                  {requestEvents.map((event) => (
                    <li key={event.id} className="relative">
                      <span
                        aria-hidden="true"
                        className="absolute -left-[27px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-navy-400"
                      />
                      <p className="text-sm font-medium text-navy-800">
                        {labels.event[event.event_type]}
                      </p>
                      <p className="text-xs text-navy-500">{formatDateTime(event.created_at, locale)}</p>
                    </li>
                  ))}
                </ol>

                <div className="mt-5 rounded-lg bg-navy-50 px-4 py-3 text-xs leading-relaxed text-navy-700">
                  {t("cd.currentStatus")} <strong>{labels.request[request.status]}</strong>.{" "}
                  {t("cd.transitionsNote")}
                </div>
              </div>
            </div>
          </article>
        );
      })}

      <ProfileEditor />
    </div>
  );
}
