"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/components/I18nProvider";
import type { TKey } from "@/lib/i18n/dictionaries";

type AssistantLink = { label: string; href: string };
type AssistantMessage = { role: "aminia" | "user"; text: string; links?: AssistantLink[] };

/**
 * Moteur d'intention d'Aminia : chaque intention associe ses mots-clés,
 * la clé de réponse i18n et des clés i18n servant de libellés d'action.
 * Aucune dépendance externe : fonctionne sans clé API, latence zéro.
 */
type Intent = { keywords: string[]; answerKey: TKey; linkKeys: TKey[] };

const INTENT_HREFS: Record<string, string> = {
  "nav.services": "/services",
  "cta.quote": "/devis",
  "footer.link.partner": "/apport-affaires",
  "footer.link.contact": "/contact",
  "footer.link.cgv": "/cgv",
};

const INTENTS: Array<Intent> = [
  {
    keywords: ["carboglace", "température", "temperature", "-78", "congél", "congel", "cryo", "bas températ"],
    answerKey: "am.answer.moto",
    linkKeys: ["nav.services"],
  },
  {
    keywords: ["prélèvement", "prelevement", "échantillon", "echantillon", "biolog", "laboratoire", "analyse", "sang", "chaîne du froid", "chaine du froid", "un 3373"],
    answerKey: "am.answer.bed",
    linkKeys: ["nav.services", "cta.quote"],
  },
  {
    keywords: ["médicament", "medicament", "pharma", "bpd", "galén", "chaîne de distribution"],
    answerKey: "am.answer.seated",
    linkKeys: ["nav.services", "cta.quote"],
  },
  {
    keywords: ["enlèvement", "enlevement", "collecte", "planifier", "planifi", "24/7", "retrait"],
    answerKey: "am.answer.parcel",
    linkKeys: ["nav.services", "cta.quote"],
  },
  {
    keywords: ["devis", "prix", "tarif", "combien", "coûte", "coute", "réserver", "reserver"],
    answerKey: "am.answer.quote",
    linkKeys: ["cta.quote"],
  },
  {
    keywords: ["partenair", "apport", "affaires", "établissement", "etablissement", "clinique"],
    answerKey: "am.answer.partner",
    linkKeys: ["footer.link.partner"],
  },
  {
    keywords: ["cgv", "condition", "annule", "paiement", "factur", "responsabilit", "rembourse"],
    answerKey: "am.answer.cgv",
    linkKeys: ["footer.link.cgv"],
  },
  {
    keywords: ["newsletter", "infolettres", "abonner"],
    answerKey: "am.answer.newsletter",
    linkKeys: ["footer.newsletter"],
  },
  {
    keywords: ["contact", "téléphone", "telephone", "horaire", "numéro", "numero", "humain", "équipe", "equipe", "e-mail"],
    answerKey: "am.answer.contact",
    linkKeys: ["footer.link.contact"],
  },
];

/** Détection d'intention par mots-clés (insensible à la casse). */
function detectIntent(input: string): Intent | null {
  const low = input.toLowerCase();
  return INTENTS.find((intent) => intent.keywords.some((keyword) => low.includes(keyword))) ?? null;
}

export default function AminiaAssistant({ newsletterUrl }: { newsletterUrl?: string | null }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([{ role: "aminia", text: t("am.welcome"), links: [] }]);
    }
  }, [open, messages.length, t]);

  useEffect(() => {
    if (open) scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [open, messages]);

  const say = useCallback((message: AssistantMessage) => {
    setMessages((current) => [...current, message]);
  }, []);

  const answerToMessage = useCallback(
    (intent: Intent | null) => {
      if (!intent) {
        say({
          role: "aminia",
          text: t("am.fallback"),
          links: [
            { label: t("nav.services"), href: "/services" },
            { label: t("footer.link.contact"), href: "/contact" },
          ],
        });
        return;
      }
      const links: AssistantLink[] = [];
      for (const key of intent.linkKeys) {
        if (key === "footer.newsletter") {
          if (newsletterUrl) links.push({ label: t("footer.newsletter"), href: newsletterUrl });
          continue;
        }
        const href = INTENT_HREFS[key];
        if (href) links.push({ label: t(key), href });
      }
      say({ role: "aminia", text: t(intent.answerKey), links });
    },
    [newsletterUrl, say, t],
  );

  function sendText(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    say({ role: "user", text: trimmed });
    setInput("");
    answerToMessage(detectIntent(trimmed));
  }

  const QUICK_ACTIONS: Array<{ key: TKey; intentKey: TKey | null }> = [
    { key: "am.q.bed", intentKey: "am.answer.bed" },
    { key: "am.q.seated", intentKey: "am.answer.seated" },
    { key: "am.q.price", intentKey: "am.answer.quote" },
    { key: "am.q.partner", intentKey: "am.answer.partner" },
    { key: "am.q.newsletter", intentKey: "am.answer.newsletter" },
  ];

  function sendQuick(action: { key: TKey; intentKey: TKey | null }) {
    say({ role: "user", text: t(action.key) });
    answerToMessage(INTENTS.find((i) => i.answerKey === action.intentKey) ?? null);
  }

  return (
    <>
      {!open && (
        <div className="fixed bottom-5 right-5 z-50">
          {/* Halo pulsé derrière le bouton */}
          <span
            aria-hidden="true"
            className="aminia-ring pointer-events-none absolute inset-0 rounded-full bg-flagred-500/40"
          />
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label={t("am.open")}
            className="aminia-pop relative flex items-center gap-2.5 overflow-hidden rounded-full bg-gradient-to-br from-navy-800 via-navy-700 to-flagred-600 px-4 py-3 text-sm font-semibold text-white shadow-xl shadow-navy-900/30 transition-transform duration-200 hover:scale-105 active:scale-95"
          >
            {/* Reflet qui traverse le bouton */}
            <span aria-hidden="true" className="absolute inset-0">
              <span className="aminia-shine absolute top-0 left-0 h-full w-1/3 bg-gradient-to-r from-transparent via-white/25 to-transparent" />
            </span>
            <span
              aria-hidden="true"
              className="aminia-bob grid h-9 w-9 place-items-center rounded-full bg-white/15 text-lg ring-1 ring-white/30"
            >
              🤖
            </span>
            <span>Aminia</span>
            {/* Pastille « en ligne » */}
            <span aria-hidden="true" className="absolute -top-0.5 right-1.5">
              <span className="block h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-navy-900 animate-pulse" />
            </span>
          </button>
        </div>
      )}

      {open && (
        <div
          role="dialog"
          aria-label={t("am.title")}
          className="aminia-pop fixed bottom-5 right-5 z-50 flex max-h-[32rem] w-[min(22rem,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-2xl border border-navy-200 bg-white shadow-2xl"
        >
          <div className="flex items-center justify-between bg-navy-800 px-4 py-3 text-white">
            <div>
              <p className="font-display text-sm font-semibold">🤖 {t("am.title")}</p>
              <p className="text-[0.7rem] text-navy-200">{t("am.status")}</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={t("am.close")}
              className="rounded-full p-1.5 text-navy-200 transition hover:bg-white/10 hover:text-white"
            >
              <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4 fill-none stroke-current" strokeWidth={2}>
                <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-navy-50/60 px-3 py-3">
            {messages.map((message, index) =>
              message.role === "user" ? (
                <div key={index} className="flex justify-end">
                  <p className="max-w-[85%] rounded-xl rounded-br-sm bg-navy-800 px-3 py-2 text-sm text-white">
                    {message.text}
                  </p>
                </div>
              ) : (
                <div key={index} className="space-y-1.5">
                  <p className="max-w-[90%] rounded-xl rounded-bl-sm bg-white px-3 py-2 text-sm text-navy-800 shadow-sm">
                    {message.text}
                  </p>
                  {message.links && message.links.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {message.links.map((link, linkIndex) => (
                        <Link
                          key={linkIndex}
                          href={link.href}
                          onClick={() => setOpen(false)}
                          className="rounded-full bg-flagred-500/10 px-3 py-1 text-[0.7rem] font-semibold text-flagred-700 transition hover:bg-flagred-500/20"
                        >
                          {link.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ),
            )}
          </div>

          <div className="flex flex-wrap gap-1.5 border-t border-navy-100 bg-white px-3 py-2">
            {QUICK_ACTIONS.map((action) => (
              <button
                key={action.key}
                type="button"
                onClick={() => sendQuick(action)}
                className="rounded-full border border-navy-200 px-2.5 py-1 text-[0.7rem] font-medium text-navy-700 transition hover:bg-navy-50"
              >
                {t(action.key)}
              </button>
            ))}
          </div>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              sendText(input);
            }}
            className="flex items-center gap-2 border-t border-navy-100 bg-white px-3 py-2.5"
          >
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder={t("am.placeholder")}
              maxLength={400}
              className="min-w-0 flex-1 rounded-full border border-navy-200 bg-white px-3 py-2 text-sm text-navy-900 placeholder:text-navy-400 focus:border-navy-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={!input.trim()}
              className="rounded-full bg-navy-800 px-3 py-2 text-xs font-semibold text-white transition hover:bg-navy-700 disabled:opacity-50"
            >
              {t("am.send")}
            </button>
          </form>

          <p className="bg-navy-50 px-3 py-1.5 text-center text-[0.65rem] text-navy-500">{t("am.disclaimer")}</p>
        </div>
      )}
    </>
  );
}
