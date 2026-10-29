"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  adminCancelShipment,
  adminCompleteShipment,
  adminConfirmShipment,
  adminCreateQuote,
  adminSendQuote,
  adminStartShipment,
  cancelMyRequest,
  markRequestUnderReview,
} from "@/lib/api";
import { toUserMessage } from "@/lib/errors";
import {
  REQUEST_STATUS_LABELS,
  SERVICE_TYPE_LABELS,
  SHIPMENT_STATUS_LABELS,
} from "@/lib/labels";
import {
  QuoteStatusBadge,
  RequestStatusBadge,
  ShipmentStatusBadge,
} from "@/components/StatusBadge";
import { formatDateTime, formatMoney } from "@/components/dashboard/ClientDashboard";
import SiteSettingsPanel from "@/components/dashboard/SiteSettingsPanel";
import StatsPanel from "@/components/dashboard/StatsPanel";
import DispatchLiveBoard from "@/components/dashboard/DispatchLiveBoard";
import DispatchCalendar from "@/components/dashboard/DispatchCalendar";
import DriverSchedulePanel from "@/components/dashboard/DriverSchedulePanel";
import DriverKpiPanel from "@/components/dashboard/DriverKpiPanel";
import UserAdminPanel from "@/components/dashboard/UserAdminPanel";
import AdminDashboard from "@/components/dashboard/AdminDashboard";
import ProfileEditor from "@/components/dashboard/ProfileEditor";
import QuoteLines from "@/components/dashboard/QuoteLines";
import type {
  DriverAssignment,
  DriverLocation,
  Profile,
  Quote,
  RequestStatus,
  Shipment,
  ShipmentEvent,
  TransportRequest,
  Vehicle,

  
} from "@/lib/types";

type Tab = "requests" | "missions" | (string & {});

const REQUEST_FILTERS: { value: RequestStatus | "all"; label: string }[] = [
  { value: "all", label: "Toutes" },
  { value: "submitted", label: "Soumises" },
  { value: "under_review", label: "En instruction" },
  { value: "quoted", label: "Devis envoyé" },
  { value: "accepted", label: "Acceptées" },
  { value: "completed", label: "Terminées" },
];

const QUOTE_OK_STATUSES: RequestStatus[] = ["submitted", "under_review", "quoted"];

const inputClass =
  "w-full rounded-lg border border-navy-200 bg-white px-3 py-2.5 text-sm text-navy-900 placeholder:text-navy-400 focus:border-navy-500 focus:outline-none focus:ring-2 focus:ring-navy-100";
const buttonPrimary =
  "rounded-full bg-navy-800 px-4 py-2 text-xs font-semibold text-white hover:bg-navy-700 disabled:opacity-60";
const buttonGhost =
  "rounded-full border border-navy-200 px-4 py-2 text-xs font-semibold text-navy-700 hover:bg-navy-50 disabled:opacity-60";
const buttonDanger =
  "rounded-full border border-flagred-600/40 px-4 py-2 text-xs font-semibold text-flagred-700 hover:bg-flagred-50 disabled:opacity-60";

export default function StaffDashboard({
  isAdmin,
  requests,
  quotes,
  shipments,
  assignments,
  drivers,
  vehicles,
  events,
  positions,
}: {
  isAdmin: boolean;
  requests: TransportRequest[];
  quotes: Quote[];
  shipments: Shipment[];
  assignments: DriverAssignment[];
  drivers: Profile[];
  vehicles: Vehicle[];
  events?: ShipmentEvent[];
  positions?: DriverLocation[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("requests");
  const [filter, setFilter] = useState<RequestStatus | "all">("all");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [quoteDraft, setQuoteDraft] = useState<Record<string, { amount: string; valid_until: string; notes: string }>>({});
  const [openQuoteFor, setOpenQuoteFor] = useState<string | null>(null);

  const [assignDraft, setAssignDraft] = useState<Record<string, { driver_id: string; vehicle_id: string }>>({});
  const [openAssignFor, setOpenAssignFor] = useState<string | null>(null);
  const [openLinesFor, setOpenLinesFor] = useState<string | null>(null);

  const visibleRequests = useMemo(
    () => (filter === "all" ? requests : requests.filter((r) => r.status === filter)),
    [requests, filter],
  );

  async function run(id: string, action: () => Promise<unknown>) {
    setPendingId(id);
    setError(null);
    try {
      await action();
      router.refresh();
    } catch (err) {
      setError(toUserMessage(err));
    } finally {
      setPendingId(null);
    }
  }

  async function handleCreateAndSend(requestId: string) {
    const draft = quoteDraft[requestId];
    if (!draft) return;
    const amount = Number(draft.amount);
    if (!Number.isFinite(amount) || amount < 0) {
      setError("Saisissez un montant validé par l'équipe.");
      return;
    }
    setPendingId(requestId);
    setError(null);
    try {
      const quote = await adminCreateQuote({
        transport_request_id: requestId,
        amount,
        valid_until: draft.valid_until ? new Date(draft.valid_until).toISOString() : null,
        notes: draft.notes.trim() || null,
      });
      await adminSendQuote(quote.id);
      setOpenQuoteFor(null);
      setQuoteDraft((prev) => ({ ...prev, [requestId]: { amount: "", valid_until: "", notes: "" } }));
      router.refresh();
    } catch (err) {
      setError(toUserMessage(err));
    } finally {
      setPendingId(null);
    }
  }

  async function handleAssign(shipmentId: string) {
    const draft = assignDraft[shipmentId];
    if (!draft?.driver_id || !draft?.vehicle_id) {
      setError("Sélectionnez un chauffeur et un véhicule.");
      return;
    }
    await run(shipmentId, async () => {
      const { assignDriver } = await import("@/lib/api");
      await assignDriver(shipmentId, draft.driver_id, draft.vehicle_id);
      setOpenAssignFor(null);
    });
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "requests", label: `Demandes (${requests.length})` },
    { id: "missions", label: `Missions (${shipments.length})` },
    { id: "agenda", label: "Agenda" },
    { id: "stats", label: "Statistiques" },
    { id: "live", label: "Suivi en direct" },
    { id: "account", label: "Mon compte" },
    ...(isAdmin
      ? ([
          { id: "users", label: "Utilisateurs" },
          { id: "fleet", label: "Flotte" },
          { id: "settings", label: "Personnalisation" },
        ] as { id: Tab; label: string }[])
      : []),
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 border-b border-navy-100 pb-3">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
              tab === t.id ? "bg-navy-800 text-white" : "bg-navy-50 text-navy-700 hover:bg-navy-100"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && (
        <p role="alert" className="rounded-lg border border-flagred-600/30 bg-flagred-50 px-4 py-3 text-sm font-medium text-flagred-700">
          {error}
        </p>
      )}
             {tab === "overview" && isAdmin && (
        <AdminDashboard requests={requests} quotes={quotes} shipments={shipments} />
      )}

      {tab === "requests" && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {REQUEST_FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setFilter(f.value)}
                className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold ${
                  filter === f.value
                    ? "border-navy-800 bg-navy-800 text-white"
                    : "border-navy-200 text-navy-700 hover:bg-navy-50"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {visibleRequests.length === 0 && (
            <div className="surface p-8 text-center text-sm text-navy-600">
              Aucune demande dans ce filtre.
            </div>
          )}

          {visibleRequests.map((request) => {
            const requestQuotes = quotes
              .filter((q) => q.transport_request_id === request.id)
              .sort((a, b) => b.version - a.version);
            const draft = quoteDraft[request.id] ?? { amount: "", valid_until: "", notes: "" };

            return (
              <article key={request.id} className="surface overflow-hidden">
                <div className="flex flex-col gap-3 border-b border-navy-100 bg-navy-50/50 p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="font-semibold text-navy-900">
                        {SERVICE_TYPE_LABELS[request.service_type]}
                      </h3>
                      <RequestStatusBadge status={request.status} />
                    </div>
                    <p className="mt-1 text-sm text-navy-700/80">
                      {request.pickup_address} → {request.dropoff_address}
                    </p>
                    <p className="mt-0.5 text-xs text-navy-500">
                      {formatDateTime(request.pickup_datetime)} · soumise le{" "}
                      {formatDateTime(request.created_at)}
                      {request.patient_name ? ` · patient : ${request.patient_name}` : ""}
                      {request.mobility_notes ? ` · mobilité : ${request.mobility_notes}` : ""}
                    </p>
                    {request.notes && (
                      <p className="mt-1 text-xs italic text-navy-500">Précisions : {request.notes}</p>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {request.status === "submitted" && (
                      <button
                        type="button"
                        disabled={pendingId === request.id}
                        onClick={() => run(request.id, () => markRequestUnderReview(request.id))}
                        className={buttonGhost}
                      >
                        Ouvrir l&apos;instruction
                      </button>
                    )}
                    {QUOTE_OK_STATUSES.includes(request.status) && (
                      <button
                        type="button"
                        onClick={() =>
                          setOpenQuoteFor(openQuoteFor === request.id ? null : request.id)
                        }
                        className={buttonPrimary}
                      >
                        {openQuoteFor === request.id ? "Fermer" : "Préparer un devis"}
                      </button>
                    )}
                    {!["cancelled", "completed"].includes(request.status) && (
                      <button
                        type="button"
                        disabled={pendingId === request.id}
                        onClick={() => run(request.id, () => cancelMyRequest(request.id, "Annulée par l'équipe"))}
                        className={buttonDanger}
                      >
                        Annuler
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid gap-6 p-5 lg:grid-cols-2">
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-widest text-navy-500">
                      Historique des devis
                    </h4>
                    {requestQuotes.length === 0 ? (
                      <p className="mt-2 text-sm text-navy-600">Aucun devis préparé.</p>
                    ) : (
                      <ul className="mt-2 space-y-2">
                        {requestQuotes.map((q) => (
                          <li
                            key={q.id}
                            className="rounded-lg border border-navy-100 bg-white px-4 py-2.5 text-sm"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="text-navy-800">
                                V{q.version} · {formatMoney(q.amount, q.currency)}
                                {q.sent_at ? ` · envoyé ${formatDateTime(q.sent_at)}` : ""}
                              </span>
                              <div className="flex flex-wrap items-center gap-2">
                                <QuoteStatusBadge status={q.status} />
                                <button
                                  type="button"
                                  onClick={() =>
                                    setOpenLinesFor((prev) => (prev === q.id ? null : q.id))
                                  }
                                  className="rounded-full border border-navy-200 px-3 py-1 text-xs font-semibold text-navy-700 transition hover:bg-navy-50"
                                >
                                  {openLinesFor === q.id ? "Masquer le détail" : "Lignes"}
                                </button>
                                <a
                                  href={`/dashboard/devis/${q.id}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="rounded-full border border-navy-200 px-3 py-1 text-xs font-semibold text-navy-700 transition hover:bg-navy-50"
                                >
                                  Aperçu / imprimer
                                </a>
                              </div>
                            </div>
                            {openLinesFor === q.id && (
                              <div className="mt-3 border-t border-navy-100 pt-3">
                                <QuoteLines
                                  quoteId={q.id}
                                  canEdit={q.status === "draft"}
                                  currency={q.currency}
                                />
                              </div>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {openQuoteFor === request.id && (
                    <div className="rounded-xl border border-navy-200 bg-navy-50/60 p-4">
                      <p className="text-sm font-semibold text-navy-900">
                        Nouveau devis — version{" "}
                        {requestQuotes.length > 0 ? requestQuotes[0].version + 1 : 1}
                      </p>
                      <div className="mt-3 space-y-3">
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div>
                            <label
                              htmlFor={`amount-${request.id}`}
                              className="mb-1 block text-xs font-semibold text-navy-700"
                            >
                              Montant validé par l&apos;équipe (EUR)
                            </label>
                            <input
                              id={`amount-${request.id}`}
                              type="number"
                              min="0"
                              step="0.01"
                              required
                              value={draft.amount}
                              onChange={(e) =>
                                setQuoteDraft((prev) => ({
                                  ...prev,
                                  [request.id]: { ...draft, amount: e.target.value },
                                }))
                              }
                              placeholder="0,00"
                              className={inputClass}
                            />
                          </div>
                          <div>
                            <label
                              htmlFor={`valid-${request.id}`}
                              className="mb-1 block text-xs font-semibold text-navy-700"
                            >
                              Valable jusqu&apos;au (facultatif)
                            </label>
                            <input
                              id={`valid-${request.id}`}
                              type="datetime-local"
                              value={draft.valid_until}
                              onChange={(e) =>
                                setQuoteDraft((prev) => ({
                                  ...prev,
                                  [request.id]: { ...draft, valid_until: e.target.value },
                                }))
                              }
                              className={inputClass}
                            />
                          </div>
                        </div>
                        <div>
                          <label
                            htmlFor={`notes-${request.id}`}
                            className="mb-1 block text-xs font-semibold text-navy-700"
                          >
                            Conditions / notes (facultatif)
                          </label>
                          <textarea
                            id={`notes-${request.id}`}
                            rows={2}
                            value={draft.notes}
                            onChange={(e) =>
                              setQuoteDraft((prev) => ({
                                ...prev,
                                [request.id]: { ...draft, notes: e.target.value },
                              }))
                            }
                            className={inputClass}
                          />
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            disabled={pendingId === request.id}
                            onClick={() => handleCreateAndSend(request.id)}
                            className={buttonPrimary}
                          >
                            {pendingId === request.id
                              ? "Création…"
                              : "Créer la version et l'envoyer au client"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setOpenQuoteFor(null)}
                            className={buttonGhost}
                          >
                            Annuler
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {tab === "missions" && (
        <div className="space-y-4">
          {shipments.length === 0 && (
            <div className="surface p-8 text-center text-sm text-navy-600">
              Aucune mission. Une mission est créée uniquement après acceptation d&apos;un devis par
              un client, puis confirmée manuellement.
            </div>
          )}

          {shipments.map((shipment) => {
            const request = requests.find((r) => r.id === shipment.transport_request_id);
            const quote = quotes.find((q) => q.id === shipment.quote_id);
            const assignment = assignments.find((a) => a.shipment_id === shipment.id);
            const draft = assignDraft[shipment.id] ?? { driver_id: "", vehicle_id: "" };
            const canAssign =
              shipment.status === "pending_confirmation" || shipment.status === "confirmed";

            return (
              <article key={shipment.id} className="surface overflow-hidden">
                <div className="flex flex-col gap-3 border-b border-navy-100 bg-navy-50/50 p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="font-semibold text-navy-900">
                        Mission du {formatDateTime(shipment.scheduled_at)}
                      </h3>
                      <ShipmentStatusBadge status={shipment.status} />
                    </div>
                    <p className="mt-1 text-sm text-navy-700/80">
                      {request
                        ? `${request.pickup_address} → ${request.dropoff_address}`
                        : "Demande associée"}
                    </p>
                    <p className="mt-0.5 text-xs text-navy-500">
                      {quote ? `Devis V${quote.version} accepté (${formatMoney(quote.amount, quote.currency)})` : ""}
                      {assignment ? ` · chauffeur affecté` : " · aucun chauffeur affecté"}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {shipment.status === "pending_confirmation" && (
                      <button
                        type="button"
                        disabled={pendingId === shipment.id}
                        onClick={() => run(shipment.id, () => adminConfirmShipment(shipment.id))}
                        className={buttonPrimary}
                      >
                        Confirmer la mission
                      </button>
                    )}
                    {shipment.status === "confirmed" && (
                      <button
                        type="button"
                        disabled={pendingId === shipment.id}
                        onClick={() => run(shipment.id, () => adminStartShipment(shipment.id))}
                        className={buttonGhost}
                      >
                        Démarrer
                      </button>
                    )}
                    {(shipment.status === "confirmed" || shipment.status === "in_progress") && (
                      <button
                        type="button"
                        disabled={pendingId === shipment.id}
                        onClick={() => run(shipment.id, () => adminCompleteShipment(shipment.id))}
                        className={buttonGhost}
                      >
                        Terminer
                      </button>
                    )}
                    {!["completed", "cancelled"].includes(shipment.status) && (
                      <button
                        type="button"
                        disabled={pendingId === shipment.id}
                        onClick={() => run(shipment.id, () => adminCancelShipment(shipment.id, "Annulée par l'équipe"))}
                        className={buttonDanger}
                      >
                        Annuler
                      </button>
                    )}
                  </div>
                </div>

                <div className="p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h4 className="text-xs font-semibold uppercase tracking-widest text-navy-500">
                      Affectation chauffeur / véhicule
                    </h4>
                    {assignment && (
                      <span className="text-xs text-navy-600">
                        Affectation en cours — {drivers.find((d) => d.id === assignment.driver_id)?.email ?? "chauffeur"} ·{" "}
                        {vehicles.find((v) => v.id === assignment.vehicle_id)?.registration_plate ?? "véhicule"}
                      </span>
                    )}
                    {canAssign && !assignment && (
                      <button
                        type="button"
                        onClick={() =>
                          setOpenAssignFor(openAssignFor === shipment.id ? null : shipment.id)
                        }
                        className={buttonGhost}
                      >
                        {openAssignFor === shipment.id ? "Fermer" : "Affecter"}
                      </button>
                    )}
                  </div>

                  {openAssignFor === shipment.id && !assignment && (
                    <div className="mt-3 grid gap-3 rounded-xl border border-navy-200 bg-navy-50/60 p-4 sm:grid-cols-[1fr_1fr_auto]">
                      <div>
                        <label htmlFor={`driver-${shipment.id}`} className="mb-1 block text-xs font-semibold text-navy-700">
                          Chauffeur
                        </label>
                        <select
                          id={`driver-${shipment.id}`}
                          value={draft.driver_id}
                          onChange={(e) =>
                            setAssignDraft((prev) => ({
                              ...prev,
                              [shipment.id]: { ...draft, driver_id: e.target.value },
                            }))
                          }
                          className={inputClass}
                        >
                          <option value="">Sélectionner…</option>
                          {drivers.map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.full_name || d.email}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label htmlFor={`vehicle-${shipment.id}`} className="mb-1 block text-xs font-semibold text-navy-700">
                          Véhicule
                        </label>
                        <select
                          id={`vehicle-${shipment.id}`}
                          value={draft.vehicle_id}
                          onChange={(e) =>
                            setAssignDraft((prev) => ({
                              ...prev,
                              [shipment.id]: { ...draft, vehicle_id: e.target.value },
                            }))
                          }
                          className={inputClass}
                        >
                          <option value="">Sélectionner…</option>
                          {vehicles.filter((v) => v.active).map((v) => (
                            <option key={v.id} value={v.id}>
                              {v.registration_plate} · {v.vehicle_type}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="flex items-end">
                        <button
                          type="button"
                          disabled={pendingId === shipment.id}
                          onClick={() => handleAssign(shipment.id)}
                          className={buttonPrimary}
                        >
                          {pendingId === shipment.id ? "Affectation…" : "Valider l'affectation"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {tab === "agenda" && (
        <div className="space-y-6">
          <DispatchCalendar shipments={shipments} requests={requests} assignments={assignments} drivers={drivers} />
          <DriverSchedulePanel drivers={drivers} shipments={shipments} assignments={assignments} requests={requests} />
          <DriverKpiPanel drivers={drivers} shipments={shipments} assignments={assignments} />
        </div>
      )}

      {tab === "stats" && (
        <StatsPanel
          requests={requests}
          quotes={quotes}
          shipments={shipments}
          assignments={assignments}
          drivers={drivers}
          vehicles={vehicles}
        />
      )}

      {tab === "live" && (
        <DispatchLiveBoard
          requests={requests}
          quotes={quotes}
          shipments={shipments}
          assignments={assignments}
          drivers={drivers}
          vehicles={vehicles}
          events={events ?? []}
          positions={positions ?? []}
        />
      )}

      {tab === "users" && isAdmin && <UserAdminPanel />}
      {tab === "fleet" && isAdmin && <FleetPanel vehicles={vehicles} />}
      {tab === "settings" && isAdmin && <SiteSettingsPanel />}
      {tab === "account" && <ProfileEditor />}
    </div>
  );
}

// ------------------------------------------------------------
// Gestion des utilisateurs (admin)
// ------------------------------------------------------------
function UsersPanel({ currentRequests }: { currentRequests: TransportRequest[] }) {
  const router = useRouter();
  const [users, setUsers] = useState<Profile[] | null>(null);
  const [banned, setBanned] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [invitePending, setInvitePending] = useState(false);
  const [invite, setInvite] = useState({ email: "", full_name: "", role: "client" });

  async function load() {
    setError(null);
    try {
      const { listAllProfiles } = await import("@/lib/api");
      const rows = await listAllProfiles();
      setUsers(rows);
      const res = await fetch("/api/admin/users");
      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; users?: { id: string; banned: boolean }[] }
        | null;
      if (res.ok && data?.ok && data.users) {
        setBanned(Object.fromEntries(data.users.map((u) => [u.id, u.banned])));
      }
    } catch (err) {
      setError(toUserMessage(err));
    }
  }

  if (!users) {
    void currentRequests;
    return (
      <div className="surface p-6">
        <button type="button" onClick={load} className={buttonPrimary}>
          Charger la liste des utilisateurs
        </button>
        {error && <p className="mt-3 text-sm text-flagred-700">{error}</p>}
      </div>
    );
  }

  async function changeRole(userId: string, role: Profile["role"]) {
    setPendingId(userId);
    setError(null);
    setInfo(null);
    try {
      const { setUserRole } = await import("@/lib/api");
      await setUserRole(userId, role);
      router.refresh();
      setUsers((prev) => (prev ? prev.map((u) => (u.id === userId ? { ...u, role } : u)) : prev));
      setInfo(`Rôle de ${role} appliqué.`);
    } catch (err) {
      setError(toUserMessage(err));
    } finally {
      setPendingId(null);
    }
  }

  async function userAction(
    key: string,
    init: { method: string; url: string; body?: unknown },
    onSuccess: () => void,
    successMessage: string,
  ) {
    setPendingId(key);
    setError(null);
    setInfo(null);
    try {
      const res = await fetch(init.url, {
        method: init.method,
        headers: init.body ? { "Content-Type": "application/json" } : undefined,
        body: init.body ? JSON.stringify(init.body) : undefined,
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        email_sent?: boolean;
        provider?: string;
      };
      if (!res.ok || !data.ok) throw new Error(data.error || "Action impossible");
      onSuccess();
      setInfo(
        successMessage + (data.provider ? ` (transport : ${data.provider})` : ""),
      );
      router.refresh();
    } catch (err) {
      setError(toUserMessage(err));
    } finally {
      setPendingId(null);
    }
  }

  async function handleInvite(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setInvitePending(true);
    setError(null);
    setInfo(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(invite),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        email_sent?: boolean;
        provider?: string;
      };
      if (!res.ok || !data.ok) throw new Error(data.error || "Création impossible");
      setInfo(
        `Compte créé pour ${invite.email}.` +
          (data.email_sent ? " Lien d'activation envoyé." : " (e-mail non expédié — lien à transmettre manuellement)"),
      );
      setInvite({ email: "", full_name: "", role: "client" });
      setInviteOpen(false);
      await load();
      router.refresh();
    } catch (err) {
      setError(toUserMessage(err));
    } finally {
      setInvitePending(false);
    }
  }

  const inviteInput =
    "w-full rounded-lg border border-navy-200 bg-white px-3 py-2 text-sm text-navy-900 placeholder:text-navy-400 focus:border-navy-500 focus:outline-none focus:ring-2 focus:ring-navy-100";

  return (
    <div className="space-y-4">
      <div className="surface p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold text-navy-900">
              Gestion des comptes
            </h2>
            <p className="text-sm text-navy-700/75">
              Inviter, bloquer ou réinitialiser un accès.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setInviteOpen((v) => !v)}
            className={buttonPrimary}
          >
            {inviteOpen ? "Fermer" : "Inviter un utilisateur"}
          </button>
        </div>

        {inviteOpen && (
          <form onSubmit={handleInvite} className="mt-4 grid gap-3 sm:grid-cols-3">
            <div>
              <label htmlFor="invite-email" className="mb-1 block text-xs font-semibold text-navy-700">
                E-mail
              </label>
              <input
                id="invite-email"
                type="email"
                required
                value={invite.email}
                onChange={(e) => setInvite((v) => ({ ...v, email: e.target.value }))}
                placeholder="prenom@exemple.fr"
                className={inviteInput}
              />
            </div>
            <div>
              <label htmlFor="invite-name" className="mb-1 block text-xs font-semibold text-navy-700">
                Nom complet
              </label>
              <input
                id="invite-name"
                type="text"
                value={invite.full_name}
                onChange={(e) => setInvite((v) => ({ ...v, full_name: e.target.value }))}
                placeholder="Prénom Nom"
                className={inviteInput}
              />
            </div>
            <div>
              <label htmlFor="invite-role" className="mb-1 block text-xs font-semibold text-navy-700">
                Rôle
              </label>
              <select
                id="invite-role"
                value={invite.role}
                onChange={(e) => setInvite((v) => ({ ...v, role: e.target.value }))}
                className={inviteInput}
              >
                {["client", "driver", "dispatcher", "admin", "partner"].map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-3">
              <button
                type="submit"
                disabled={invitePending}
                className="rounded-lg bg-flagred-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-flagred-700 disabled:opacity-60"
              >
                {invitePending ? "Création…" : "Créer le compte et envoyer l'invitation"}
              </button>
            </div>
          </form>
        )}
      </div>

      {error && (
        <p role="alert" className="rounded-lg border border-flagred-600/30 bg-flagred-50 px-4 py-3 text-sm font-medium text-flagred-700">
          {error}
        </p>
      )}
      {info && (
        <p className="rounded-lg border border-navy-200 bg-navy-50 px-4 py-3 text-sm font-medium text-navy-800">
          {info}
        </p>
      )}

      <div className="surface overflow-x-auto p-5">
        <table className="w-full min-w-[52rem] text-left text-sm">
          <thead>
            <tr className="border-b border-navy-100 text-xs uppercase tracking-wider text-navy-500">
              <th className="py-2 pr-4">Utilisateur</th>
              <th className="py-2 pr-4">E-mail</th>
              <th className="py-2 pr-4">Rôle</th>
              <th className="py-2 pr-4">État</th>
              <th className="py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const isBanned = Boolean(banned[u.id]);
              const busy = pendingId === u.id || pendingId === `invite:${u.id}`;
              return (
                <tr key={u.id} className="border-b border-navy-50">
                  <td className="py-3 pr-4 font-medium text-navy-900">{u.full_name || "—"}</td>
                  <td className="py-3 pr-4 text-navy-700">{u.email}</td>
                  <td className="py-3 pr-4">
                    <select
                      value={u.role}
                      disabled={busy}
                      onChange={(e) => changeRole(u.id, e.target.value as Profile["role"])}
                      className="rounded-lg border border-navy-200 bg-white px-3 py-1.5 text-xs font-semibold text-navy-800 disabled:opacity-60"
                      aria-label={`Rôle de ${u.email}`}
                    >
                      {["client", "driver", "dispatcher", "admin", "partner"].map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-3 pr-4">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                        isBanned
                          ? "bg-flagred-50 text-flagred-700"
                          : "bg-emerald-50 text-emerald-700"
                      }`}
                    >
                      {isBanned ? "Bloqué" : "Actif"}
                    </span>
                  </td>
                  <td className="py-3">
                    <div className="flex flex-wrap gap-2 text-xs font-semibold">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          void userAction(
                            u.id,
                            {
                              method: "PATCH",
                              url: "/api/admin/users",
                              body: { user_id: u.id, action: isBanned ? "unban" : "ban" },
                            },
                            () =>
                              setBanned((prev) => ({ ...prev, [u.id]: !isBanned })),
                            isBanned ? `Compte ${u.email} débloqué.` : `Compte ${u.email} bloqué.`,
                          )
                        }
                        className={`rounded-lg border px-3 py-1.5 transition disabled:opacity-60 ${
                          isBanned
                            ? "border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                            : "border-navy-200 text-navy-700 hover:bg-navy-50"
                        }`}
                      >
                        {isBanned ? "Débloquer" : "Bloquer"}
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          void userAction(
                            `reset:${u.id}`,
                            {
                              method: "PATCH",
                              url: "/api/admin/users",
                              body: { user_id: u.id, action: "reset_password" },
                            },
                            () => undefined,
                            `Lien de réinitialisation envoyé à ${u.email}.`,
                          )
                        }
                        className="rounded-lg border border-navy-200 px-3 py-1.5 text-navy-700 transition hover:bg-navy-50 disabled:opacity-60"
                      >
                        Mot de passe
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          if (
                            !window.confirm(
                              `Supprimer définitivement le compte ${u.email} ? Cette action est irréversible.`,
                            )
                          ) {
                            return;
                          }
                          void userAction(
                            `del:${u.id}`,
                            { method: "DELETE", url: `/api/admin/users?user_id=${encodeURIComponent(u.id)}` },
                            () => setUsers((prev) => (prev ? prev.filter((p) => p.id !== u.id) : prev)),
                            `Compte ${u.email} supprimé.`,
                          );
                        }}
                        className="rounded-lg border border-flagred-300 px-3 py-1.5 text-flagred-700 transition hover:bg-flagred-50 disabled:opacity-60"
                      >
                        Supprimer
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// Gestion de la flotte (admin)
// ------------------------------------------------------------
function FleetPanel({ vehicles }: { vehicles: Vehicle[] }) {
  const router = useRouter();
  const [plate, setPlate] = useState("");
  const [type, setType] = useState<Vehicle["vehicle_type"]>("sedan");
  const [capacity, setCapacity] = useState("1");
  const [lift, setLift] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function addVehicle(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const { createVehicle } = await import("@/lib/api");
      await createVehicle({
        registration_plate: plate.trim().toUpperCase(),
        vehicle_type: type,
        capacity: Number(capacity) || 1,
        has_wheelchair_lift: lift,
      });
      setPlate("");
      setLift(false);
      router.refresh();
    } catch (err) {
      setError(toUserMessage(err));
    } finally {
      setPending(false);
    }
  }

  async function toggleActive(vehicle: Vehicle) {
    setError(null);
    try {
      const { updateVehicleActive } = await import("@/lib/api");
      await updateVehicleActive(vehicle.id, !vehicle.active);
      router.refresh();
    } catch (err) {
      setError(toUserMessage(err));
    }
  }

  return (
    <div className="space-y-5">
      <form onSubmit={addVehicle} className="surface grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-5 lg:items-end">
        <div>
          <label htmlFor="v-plate" className="mb-1 block text-xs font-semibold text-navy-700">
            Immatriculation
          </label>
          <input
            id="v-plate"
            required
            pattern="[A-Za-z0-9\-]{6,12}"
            value={plate}
            onChange={(e) => setPlate(e.target.value)}
            placeholder="AB-123-CD"
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="v-type" className="mb-1 block text-xs font-semibold text-navy-700">
            Type
          </label>
          <select
            id="v-type"
            value={type}
            onChange={(e) => setType(e.target.value as Vehicle["vehicle_type"])}
            className={inputClass}
          >
            {["sedan", "van", "minibus", "stretcher_van", "ambulance"].map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="v-capacity" className="mb-1 block text-xs font-semibold text-navy-700">
            Capacité
          </label>
          <input
            id="v-capacity"
            type="number"
            min="1"
            max="20"
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
            className={inputClass}
          />
        </div>
        <label className="flex items-center gap-2 pb-2.5 text-sm text-navy-800">
          <input type="checkbox" checked={lift} onChange={(e) => setLift(e.target.checked)} className="h-4 w-4 accent-navy-800" />
          Plateforme fauteuil
        </label>
        <button type="submit" disabled={pending} className={buttonPrimary}>
          {pending ? "Ajout…" : "Ajouter le véhicule"}
        </button>
        {error && <p className="text-sm text-flagred-700 sm:col-span-2 lg:col-span-5">{error}</p>}
      </form>

      <div className="surface overflow-x-auto p-5">
        <table className="w-full min-w-[36rem] text-left text-sm">
          <thead>
            <tr className="border-b border-navy-100 text-xs uppercase tracking-wider text-navy-500">
              <th className="py-2 pr-4">Immatriculation</th>
              <th className="py-2 pr-4">Type</th>
              <th className="py-2 pr-4">Capacité</th>
              <th className="py-2 pr-4">Plateforme</th>
              <th className="py-2">État</th>
            </tr>
          </thead>
          <tbody>
            {vehicles.map((v) => (
              <tr key={v.id} className="border-b border-navy-50">
                <td className="py-3 pr-4 font-semibold text-navy-900">{v.registration_plate}</td>
                <td className="py-3 pr-4 text-navy-700">{v.vehicle_type}</td>
                <td className="py-3 pr-4 text-navy-700">{v.capacity}</td>
                <td className="py-3 pr-4 text-navy-700">{v.has_wheelchair_lift ? "Oui" : "Non"}</td>
                <td className="py-3">
                  <button
                    type="button"
                    onClick={() => toggleActive(v)}
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      v.active
                        ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                        : "bg-slate-100 text-slate-600 border border-slate-200"
                    }`}
                  >
                    {v.active ? "Actif — désactiver" : "Inactif — activer"}
                  </button>
                </td>
              </tr>
            ))}
            {vehicles.length === 0 && (
              <tr>
                <td colSpan={5} className="py-6 text-center text-navy-500">
                  Aucun véhicule enregistré.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
