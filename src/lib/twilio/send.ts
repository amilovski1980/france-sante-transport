import { loadAppSettings } from "@/lib/app-settings";

export type SmsProvider = "twilio" | "none";

export interface SmsResult {
  ok: boolean;
  provider: SmsProvider;
  error?: string;
}

/**
 * Envoi d'un SMS transactionnel via Twilio (REST, sans SDK).
 * Ne lève jamais : l'échec SMS ne casse pas le flux métier.
 */
export async function sendSms(input: { to: string; body: string }): Promise<SmsResult> {
  try {
    const s = await loadAppSettings();
    const { twilio_account_sid: sid, twilio_auth_token: token, twilio_from: from } = s;
    if (!sid || !token || !from) {
      return { ok: false, provider: "none", error: "Twilio non configuré (Services & API)" };
    }
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ From: from, To: input.to, Body: input.body }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return { ok: false, provider: "twilio", error: `Twilio ${res.status}: ${detail.slice(0, 200)}` };
    }
    return { ok: true, provider: "twilio" };
  } catch (err) {
    return { ok: false, provider: "twilio", error: err instanceof Error ? err.message : String(err) };
  }
}
