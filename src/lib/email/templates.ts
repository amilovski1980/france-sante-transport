export interface EmailContent {
  subject: string;
  html: string;
  text: string;
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function formatAmount(amount: number, currency = "EUR"): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency }).format(amount);
}

export function formatDate(value: string): string {
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeStyle: "short" }).format(
    new Date(value),
  );
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

function shell(title: string, bodyHtml: string): string {
  return [
    '<!doctype html><html lang="fr"><body style="margin:0;background:#f0f4fa;font-family:Arial,Helvetica,sans-serif;">',
    '<div style="max-width:560px;margin:0 auto;padding:24px 16px;">',
    '<div style="background:#061a33;border-radius:12px 12px 0 0;padding:20px 24px;">',
    '<span style="color:#ffffff;font-size:18px;font-weight:bold;">France Santé Transport</span>',
    '</div>',
    '<div style="background:#ffffff;border:1px solid #dbe5f3;border-top:none;border-radius:0 0 12px 12px;padding:24px;">',
    `<h1 style="margin:0 0 16px;font-size:18px;color:#061a33;">${title}</h1>`,
    bodyHtml,
    '</div>',
    '<p style="text-align:center;color:#6b7a90;font-size:12px;margin-top:16px;">',
    'France Santé Transport — le transport qui fait avancer la santé',
    '</p></div></body></html>',
  ].join("");
}

function linkBlock(label: string, href: string): string {
  return `<p style="margin:20px 0;"><a href="${escapeHtml(href)}" style="display:inline-block;background:#0a1f44;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:999px;font-size:14px;font-weight:bold;">${escapeHtml(label)}</a></p>`;
}

function signature(): string {
  return '<p style="color:#6b7a90;font-size:13px;margin-top:24px;">L’équipe FST vous répond du lundi au samedi.</p>';
}

/** Demande bien reçue (accusé de réception au client). */
export function requestReceivedEmail(input: {
  clientName: string;
  pickupAddress: string;
  dropoffAddress: string;
  pickupDatetime: string;
}): EmailContent {
  const subject = "Votre demande de transport est bien reçue";
  const html = shell(
    `Bonjour ${escapeHtml(input.clientName)},`,
    [
      "<p>Votre demande de transport a bien été enregistrée. Notre équipe l’instruit et vous adresse un devis dans les meilleurs délais.</p>",
      `<p><strong>Départ :</strong> ${escapeHtml(input.pickupAddress)}<br>` +
        `<strong>Arrivée :</strong> ${escapeHtml(input.dropoffAddress)}<br>` +
        `<strong>Horaire souhaité :</strong> ${escapeHtml(formatDate(input.pickupDatetime))}</p>`,
      linkBlock("Suivre ma demande", `${APP_URL}/dashboard`),
      signature(),
    ].join(""),
  );
  const text = [
    `Bonjour ${input.clientName},`,
    "",
    "Votre demande de transport a bien été enregistrée.",
    `Départ : ${input.pickupAddress}`,
    `Arrivée : ${input.dropoffAddress}`,
    `Horaire souhaité : ${formatDate(input.pickupDatetime)}`,
    "",
    `Suivre ma demande : ${APP_URL}/dashboard`,
  ].join("\n");
  return { subject, html, text };
}

/** Devis envoyé par le dispatch au client. */
export function quoteSentEmail(input: {
  clientName: string;
  version: number;
  amount: number;
  currency: string;
  validUntil: string | null;
  pickupAddress: string;
  dropoffAddress: string;
}): EmailContent {
  const subject = `Votre devis n° ${input.version} vous attend`;
  const validity = input.validUntil
    ? `<p style="font-size:13px;color:#6b7a90;">Devis valable jusqu’au ${escapeHtml(formatDate(input.validUntil))}.</p>`
    : "";
  const html = shell(
    `Bonjour ${escapeHtml(input.clientName)},`,
    [
      `<p>Un devis personnalisé est disponible pour votre trajet :</p>`,
      `<p style="background:#f0f4fa;border-radius:8px;padding:12px 16px;">` +
        `<strong>${escapeHtml(input.pickupAddress)}</strong> → <strong>${escapeHtml(input.dropoffAddress)}</strong><br>` +
        `<span style="font-size:13px;color:#6b7a90;">Devis version ${input.version}</span></p>`,
      `<p style="font-size:24px;font-weight:bold;color:#0a1f44;margin:16px 0 0;">${escapeHtml(formatAmount(input.amount, input.currency))}</p>`,
      validity,
      linkBlock("Consulter et accepter le devis", `${APP_URL}/dashboard`),
      signature(),
    ].join(""),
  );
  const text = [
    `Bonjour ${input.clientName},`,
    "",
    `Devis version ${input.version} disponible : ${formatAmount(input.amount, input.currency)}`,
    `${input.pickupAddress} → ${input.dropoffAddress}`,
    input.validUntil ? `Valable jusqu'au ${formatDate(input.validUntil)}` : "",
    "",
    `${APP_URL}/dashboard`,
  ].filter(Boolean).join("\n");
  return { subject, html, text };
}

/** Nouvelle mission proposée à un chauffeur. */
export function assignmentProposedEmail(input: {
  driverName: string;
  scheduledAt: string;
  pickupAddress: string;
  dropoffAddress: string;
  vehicleLabel: string | null;
  registrationPlate: string;
}): EmailContent {
  const subject = "Nouvelle mission proposée";
  const vehicle = input.vehicleLabel
    ? `${escapeHtml(input.vehicleLabel)} (${escapeHtml(input.registrationPlate)})`
    : escapeHtml(input.registrationPlate);
  const html = shell(
    `Bonjour ${escapeHtml(input.driverName)},`,
    [
      "<p>Une nouvelle mission vous est proposée. Répondez depuis votre espace chauffeur :</p>",
      `<p style="background:#f0f4fa;border-radius:8px;padding:12px 16px;">` +
        `<strong>${escapeHtml(formatDate(input.scheduledAt))}</strong><br>` +
        `${escapeHtml(input.pickupAddress)} → ${escapeHtml(input.dropoffAddress)}<br>` +
        `<span style="font-size:13px;color:#6b7a90;">Véhicule : ${vehicle}</span></p>`,
      linkBlock("Accepter ou refuser", `${APP_URL}/dashboard`),
      signature(),
    ].join(""),
  );
  const text = [
    `Bonjour ${input.driverName},`,
    "",
    `Mission proposée : ${formatDate(input.scheduledAt)}`,
    `${input.pickupAddress} → ${input.dropoffAddress}`,
    `Véhicule : ${input.vehicleLabel ?? ""} ${input.registrationPlate}`.trim(),
    "",
    `${APP_URL}/dashboard`,
  ].join("\n");
  return { subject, html, text };
}

/** Invitation d'un nouvel utilisateur (compte créé par un administrateur). */
export function inviteUserEmail(input: { name: string; email: string; url: string }): EmailContent {
  const subject = "Votre compte France Santé Transport est prêt";
  const html = shell(
    `Bonjour ${escapeHtml(input.name)},`,
    [
      `<p>Un administrateur a créé un compte pour vous sur France Santé Transport (adresse <strong>${escapeHtml(input.email)}</strong>).</p>`,
      "<p>Connectez-vous puis choisissez votre mot de passe depuis cet espace sécurisé :</p>",
      linkBlock("Activer mon compte", input.url),
      signature(),
    ].join(""),
  );
  const text = [
    `Bonjour ${input.name},`,
    "",
    `Votre compte (${input.email}) est prêt sur France Santé Transport.`,
    `Activez-le : ${input.url}`,
  ].join("\n");
  return { subject, html, text };
}

/** Réinitialisation de mot de passe. */
export function passwordResetEmail(input: { name: string; url: string }): EmailContent {
  const subject = "Réinitialiser votre mot de passe";
  const html = shell(
    `Bonjour ${escapeHtml(input.name)},`,
    [
      "<p>Une réinitialisation de mot de passe a été demandée pour votre compte.</p>",
      linkBlock("Choisir un nouveau mot de passe", input.url),
      '<p style="font-size:13px;color:#6b7a90;">Si ce n’est pas vous, ignorez cet e-mail.</p>',
      signature(),
    ].join(""),
  );
  const text = [
    `Bonjour ${input.name},`,
    "",
    "Réinitialisez votre mot de passe :",
    input.url,
    "",
    "Si ce n'est pas vous, ignorez cet e-mail.",
  ].join("\n");
  return { subject, html, text };
}
