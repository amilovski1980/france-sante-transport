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

/** Mots de salutation reconnus en début de message. */
const GREETING_WORDS = [
  "bonjour",
  "bonsoir",
  "salut",
  "coucou",
  "hello",
  "hey",
  "hi",
  "good morning",
  "good afternoon",
  "good evening",
];

/** Détecte une intention par mots-clés (insensible à la casse). */
function detectIntent(input: string): Intent | null {
  const low = input.toLowerCase();
  return INTENTS.find((intent) => intent.keywords.some((keyword) => low.includes(keyword))) ?? null;
}

/** Clé i18n de la salutation adaptée à l'heure de la journée. */
function timeGreetKey(): TKey {
  const hour = new Date().getHours();
  if (hour < 12) return "am.greet.morning";
  if (hour < 18) return "am.greet.afternoon";
  return "am.greet.evening";
}

/** Le message commence-t-il par une salutation ? */
function greetingPrefix(input: string): TKey | null {
  const low = input.toLowerCase().trimStart();
  for (const word of GREETING_WORDS) {
    if (low.startsWith(word)) return timeGreetKey();
  }
  return null;
}

/** Le message est-il une expressions de remerciement isolée ? */
function isThanks(input: string): boolean {
  const low = input.toLowerCase().trim();
  return low.length <= 30 && /(merci|thanks|thank you|bien reçu)/.test(low);
}

/** Le message est-il une salutation seule (sans autre demande) ? */
function isBareGreeting(input: string): boolean {
  const low = input.toLowerCase().trim();
  return low.length <= 22 && GREETING_WORDS.some((word) => low === word || low.startsWith(`${word} `) || low.startsWith(`${word},`) || low.startsWith(`${word}!`));
}

/** Preconditions : profil visiteur connu ? (première visite vs fidèle) — localStorage. */
function isReturningVisitor(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (window.localStorage.getItem("fst-aminia-visit") === "1") return true;
    window.localStorage.setItem("fst-aminia-visit", "1");
  } catch {
    /* mode privé : considéré nouvelle visite */
  }
  return false;
}

/**
 * Logo Aminia : bulle de conversation dégradée avec trois points —
 * identité visuelle propre, sans emoji génériques.
 */
function AminiaMark({ size = 36, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 48 48"
      width={size}
      height={size}
      className={className}
    >
      <defs>
        <linearGradient id="aminia-mark-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#1e2f5c" />
          <stop offset="55%" stopColor="#243a6e" />
          <stop offset="100%" stopColor="#c0392b" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="46" height="46" rx="13" fill="url(#aminia-mark-g)" />
      <path
        d="M15 12h18c3.3 0 6 2.7 6 6v9c0 3.3-2.7 6-6 6H24l-7 6v-6h-2c-3.3 0-6-2.7-6-6v-9c0-3.3 2.7-6 6-6z"
        fill="#ffffff"
        opacity="0.95"
      />
      <circle cx="18.5" cy="22.5" r="2.5" fill="#1e2f5c" />
      <circle cx="27.5" cy="22.5" r="2.5" fill="#1e2f5c" />
      <circle cx="36" cy="22.5" r="2.5" fill="#1e2f5c" />
    </svg>
  );
}

export default function AminiaAssistant({ newsletterUrl }: { newsletterUrl?: string | null }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const thinkingTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (thinkingTimerRef.current) window.clearTimeout(thinkingTimerRef.current);
    };
  }, []);

  /** Message d'ouverture : salutation selon l'heure + nouveau/retour. */
  const buildOpeningMessage = useCallback((): AssistantMessage => {
    const returned = isReturningVisitor();
    const text = returned
      ? `${t(timeGreetKey())} ${t("am.welcomeBack")}`
      : `${t(timeGreetKey())} ${t("am.welcome")}`;
    return { role: "aminia", text, links: [] };
  }, [t]);

  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([buildOpeningMessage()]);
    }
  }, [open, messages.length, buildOpeningMessage]);

  useEffect(() => {
    if (open) scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [open, messages, thinking]);

  const say = useCallback((message: AssistantMessage) => {
    setMessages((current) => [...current, message]);
  }, []);

  const linksForIntent = useCallback(
    (intent: Intent): AssistantLink[] => {
      const links: AssistantLink[] = [];
      for (const key of intent.linkKeys) {
        if (key === "footer.newsletter") {
          if (newsletterUrl) links.push({ label: t("footer.newsletter"), href: newsletterUrl });
          continue;
        }
        const href = INTENT_HREFS[key];
        if (href) links.push({ label: t(key), href });
      }
      return links;
    },
    [newsletterUrl, t],
  );

  /** Réponse après un délai de réflexion, proportionné à la demande. */
  function planReply(builder: () => AssistantMessage, delay = 650) {
    if (thinkingTimerRef.current) window.clearTimeout(thinkingTimerRef.current);
    setThinking(true);
    thinkingTimerRef.current = window.setTimeout(() => {
      setThinking(false);
      say(builder());
    }, delay);
  }

  function sendText(text: string) {
    const trimmed = text.trim();
    if (!trimmed || thinking) return;
    say({ role: "user", text: trimmed });
    setInput("");

    const low = trimmed.toLowerCase();
    const intent = detectIntent(low);
    const delay = 560 + Math.min(760, trimmed.length * 16);

    // 1) Salutation seule → réponse situation (heure + orientation).
    if (isBareGreeting(trimmed)) {
      planReply(() => ({
        role: "aminia",
        text: `${t(timeGreetKey())} ${t("am.answer.greet")}`,
        links: [
          { label: t("nav.services"), href: "/services" },
          { label: t("cta.quote"), href: "/devis" },
        ],
      }), delay);
      return;
    }

    // 2) Remerciement isolé → réponse courtoise.
    if (isThanks(trimmed) && !intent) {
      planReply(() => ({
        role: "aminia",
        text: t("am.answer.thanks"),
        links: [{ label: t("footer.link.contact"), href: "/contact" }],
      }), delay);
      return;
    }

    // 3) Intention métier, précédée d'une salutation le cas échéant.
    if (intent) {
      planReply(() => {
        const greeting = greetingPrefix(trimmed);
        const answer = greeting ? `${t(greeting)} ${t(intent.answerKey)}` : t(intent.answerKey);
        return { role: "aminia", text: answer, links: linksForIntent(intent) };
      }, delay);
      return;
    }

    // 4) Pas compris → réponse d'orientation.
    planReply(() => ({
      role: "aminia",
      text: t("am.fallback"),
      links: [
        { label: t("nav.services"), href: "/services" },
        { label: t("footer.link.contact"), href: "/contact" },
      ],
    }), delay);
  }

  const QUICK_ACTIONS: Array<{ key: TKey; intentKey: TKey }> = [
    { key: "am.q.bed", intentKey: "am.answer.bed" },
    { key: "am.q.seated", intentKey: "am.answer.seated" },
    { key: "am.q.price", intentKey: "am.answer.quote" },
    { key: "am.q.partner", intentKey: "am.answer.partner" },
    { key: "am.q.newsletter", intentKey: "am.answer.newsletter" },
  ];

  function sendQuick(action: { key: TKey; intentKey: TKey }) {
    if (thinking) return;
    say({ role: "user", text: t(action.key) });
    const intent = INTENTS.find((i) => i.answerKey === action.intentKey) ?? null;
    if (intent) {
      planReply(() => ({ role: "aminia", text: t(intent.answerKey), links: linksForIntent(intent) }));
    }
  }

  return (
    <>
      {!open && (
        <div className="fixed bottom-20 right-4 z-50 sm:bottom-5 sm:right-5">
          {/* Halo pulsé derrière le bouton */}
          <span
            aria-hidden="true"
            className="aminia-ring pointer-events-none absolute inset-0 rounded-2xl bg-flagred-500/30"
          />
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label={t("am.open")}
            className="aminia-pop relative flex items-center gap-3 overflow-hidden rounded-2xl bg-navy-900 px-4 py-3 text-sm font-medium text-white shadow-2xl shadow-navy-900/40 transition-all duration-200 hover:scale-[1.03] active:scale-[0.98]"
          >
            {/* Voile glass premium */}
            <span aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-white/10 to-transparent" />
            {/* Reflet discret qui traverse le bouton */}
            <span aria-hidden="true" className="absolute inset-0">
              <span className="aminia-shine absolute top-0 left-0 h-full w-1/4 bg-gradient-to-r from-transparent via-white/15 to-transparent" />
            </span>
            <span aria-hidden="true" className="aminia-bob relative">
              <AminiaMark size={38} />
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
          className="aminia-pop fixed bottom-20 right-4 z-50 flex max-h-[32rem] w-[min(22rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-navy-200 bg-white shadow-2xl sm:bottom-5 sm:right-5 sm:w-[min(22rem,calc(100vw-2.5rem))]"
        >
          <div className="flex items-center justify-between bg-gradient-to-r from-navy-900 via-navy-800 to-navy-700 px-4 py-3 text-white">
            <div className="flex items-center gap-2.5">
              <AminiaMark size={34} />
              <div>
                <p className="font-display text-sm font-semibold">{t("am.title")}</p>
                <p className="text-[0.7rem] text-navy-200">{t("am.status")}</p>
              </div>
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
                <div key={index} className="aminia-reveal flex justify-end">
                  <p className="max-w-[85%] rounded-xl rounded-br-sm bg-navy-800 px-3 py-2 text-sm text-white">
                    {message.text}
                  </p>
                </div>
              ) : (
                <div key={index} className="aminia-reveal space-y-1.5">
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

            {thinking && (
              <div className="aminia-reveal flex items-center gap-2">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white shadow-sm">
                  <AminiaMark size={22} />
                </span>
                <span
                  className="flex items-center gap-1 rounded-xl rounded-bl-sm bg-white px-3 py-2.5 shadow-sm"
                  aria-label={t("am.thinking")}
                >
                  <span className="aminia-dot block h-1.5 w-1.5 rounded-full bg-navy-400" />
                  <span className="aminia-dot aminia-dot-2 block h-1.5 w-1.5 rounded-full bg-navy-400" />
                  <span className="aminia-dot aminia-dot-3 block h-1.5 w-1.5 rounded-full bg-navy-400" />
                </span>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5 border-t border-navy-100 bg-white px-3 py-2">
            {QUICK_ACTIONS.map((action) => (
              <button
                key={action.key}
                type="button"
                onClick={() => sendQuick(action)}
                disabled={thinking}
                className="rounded-full border border-navy-200 px-2.5 py-1 text-[0.7rem] font-medium text-navy-700 transition hover:bg-navy-50 disabled:opacity-50"
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
              disabled={!input.trim() || thinking}
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
