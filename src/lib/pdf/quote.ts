import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { Quote, QuoteClient, QuoteLine, TransportRequest } from "@/lib/types";

const NAVY = rgb(0.03, 0.1, 0.22);
const SLATE = rgb(0.28, 0.33, 0.4);
const LIGHT = rgb(0.94, 0.96, 0.98);
const GREY = rgb(0.88, 0.9, 0.93);
const RED = rgb(0.78, 0.06, 0.18);

/** Découpe un texte en lignes d'au plus maxChars caractères. */
function wrap(text: string, maxChars: number): string[] {
  const out: string[] = [];
  for (const raw of String(text ?? "").split(/\r?\n/)) {
    let line = "";
    for (const word of raw.split(/\s+/)) {
      const candidate = line ? `${line} ${word}` : word;
      if (candidate.length > maxChars) {
        if (line) out.push(line);
        line = word.slice(0, maxChars);
      } else {
        line = candidate;
      }
    }
    out.push(line);
  }
  return out;
}

function fmtMoney(amount: number, currency = "EUR"): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency }).format(amount);
}

function fmtDate(value: string | null | undefined): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

/**
 * Construit le PDF du devis (A4) — même contenu que la page imprimable,
 * avec le libellé « Signature du client : » qui sert d'ancrage DocuSign.
 */
export async function buildQuotePdf(input: {
  quote: Quote;
  lines: QuoteLine[];
  request: TransportRequest;
  client: QuoteClient | null;
}): Promise<Uint8Array> {
  const { quote, request, client } = input;
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = doc.addPage([595.28, 841.89]); // A4
  const width = 595.28;
  const money = (n: number) => fmtMoney(n, quote.currency);

  // En-tête bandeau
  page.drawRectangle({ x: 0, y: 768, width, height: 46, color: LIGHT });
  page.drawText("FRANCE SANTÉ TRANSPORT", { x: 40, y: 792, size: 15, font: bold, color: NAVY });
  page.drawText("Logistique de santé — Transport biologique · Pharmaceutique · Carboglace", { x: 40, y: 778, size: 8, font, color: SLATE });
  page.drawText("DEVIS", { x: width - 105, y: 786, size: 20, font: bold, color: RED });
  page.drawText(`Version V${quote.version} · ${fmtDate(quote.created_at)}`, { x: width - 178, y: 776, size: 7.5, font, color: SLATE });

  // Colonne gauche : client
  let y = 750;
  page.drawText("CLIENT", { x: 40, y, size: 7.5, font: bold, color: SLATE });
  y -= 14;
  for (const line of wrap(client?.full_name || client?.email || "—", 34)) {
    page.drawText(line, { x: 40, y, size: 10, font: bold, color: NAVY });
    y -= 12;
  }
  for (const line of wrap(client?.email ?? "", 34)) {
    page.drawText(line, { x: 40, y, size: 8.5, font, color: SLATE });
    y -= 11;
  }
  if (client?.phone) {
    page.drawText(`Tel : ${client.phone}`, { x: 40, y, size: 8.5, font, color: SLATE });
    y -= 11;
  }

  // Colonne droite : prestation
  let yr = 750;
  page.drawText("PRESTATION", { x: 305, y: yr, size: 7.5, font: bold, color: SLATE });
  yr -= 14;
  for (const line of wrap(`${request.pickup_address} → ${request.dropoff_address}`, 46)) {
    page.drawText(line, { x: 305, y: yr, size: 8.5, font: bold, color: NAVY });
    yr -= 11.5;
  }
  page.drawText(fmtDate(request.pickup_datetime), { x: 305, y: yr, size: 8.5, font, color: SLATE });
  yr -= 11.5;
  if (request.patient_name) {
    page.drawText(`Produit : ${request.patient_name}`, { x: 305, y: yr, size: 8.5, font, color: SLATE });
    yr -= 11.5;
  }

  // Curseur commun au-dessous des deux colonnes
  y = Math.min(y, yr) - 14;

  // Tableau
  page.drawText("Désignation", { x: 40, y, size: 7.5, font: bold, color: SLATE });
  page.drawText("Qté", { x: 372, y, size: 7.5, font: bold, color: SLATE });
  page.drawText("Unitaire", { x: 420, y, size: 7.5, font: bold, color: SLATE });
  page.drawText("Total", { x: 516, y, size: 7.5, font: bold, color: SLATE });
  page.drawLine({ start: { x: 40, y: y - 5 }, end: { x: width - 40, y: y - 5 }, thickness: 1, color: NAVY });
  y -= 20;

  const rows =
    input.lines.length > 0
      ? input.lines.map((l) => ({ label: wrap(l.description, 62), qty: Number(l.quantity), unit: Number(l.unit_price) }))
      : [{ label: ["Transport médical conforme à la demande"], qty: 1, unit: Number(quote.amount) }];

  for (const row of rows) {
    const baseY = y - 9 * (row.label.length - 1);
    for (let i = 0; i < row.label.length; i++) {
      page.drawText(row.label[i], { x: 40, y: y - 9 * i, size: 9, font, color: NAVY });
    }
    page.drawText(String(row.qty), { x: 374, y: baseY, size: 9, font, color: SLATE });
    page.drawText(money(row.unit), { x: 418, y: baseY, size: 9, font, color: SLATE });
    page.drawText(money(row.qty * row.unit), { x: 500, y: baseY, size: 9, font: bold, color: NAVY });
    y -= 9 * row.label.length + 6;
    page.drawLine({ start: { x: 40, y }, end: { x: width - 40, y }, thickness: 0.5, color: GREY });
    y -= 4;
  }

  // Total TTC
  y -= 6;
  page.drawText("TOTAL TTC", { x: 372, y, size: 10, font: bold, color: SLATE });
  page.drawText(money(Number(quote.amount)), { x: 495, y: y - 4, size: 15, font: bold, color: NAVY });
  y -= 34;

  if (quote.notes) {
    for (const line of wrap(`Note : ${quote.notes}`, 108)) {
      page.drawText(line, { x: 40, y, size: 8.5, font, color: SLATE });
      y -= 11.5;
    }
    y -= 10;
  }

  // Conditions
  page.drawText("Conditions", { x: 40, y, size: 8, font: bold, color: SLATE });
  y -= 12;
  for (const line of wrap(
    "Devis valable jusqu'à sa date d'expiration. Acceptation par la signature présente ou par retour d'e-mail. Facturation après réalisation de la mission.",
    118,
  )) {
    page.drawText(line, { x: 40, y, size: 8, font, color: SLATE });
    y -= 11;
  }

  // Bandeau signature (ancrage DocuSign)
  page.drawText("Signature du client :", { x: 40, y: 60, size: 9, font: bold, color: NAVY });
  page.drawText("Fait à ______________________ le ____ / ____ / ______", { x: 158, y: 60, size: 9, font, color: SLATE });

  page.drawText("France Santé Transport — 01 84 80 00 00 · devis@france-sante-transport.fr", { x: 40, y: 36, size: 7.5, font, color: rgb(0.58, 0.63, 0.7) });

  return doc.save();
}
