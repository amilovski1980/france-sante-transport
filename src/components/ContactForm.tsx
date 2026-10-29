"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { sendContactMessage } from "@/lib/api";
import { toUserMessage } from "@/lib/errors";
import { useI18n } from "@/components/I18nProvider";
import type { TKey } from "@/lib/i18n/dictionaries";
import type { ContactTopic } from "@/lib/types";

const TOPIC_OPTIONS: { value: ContactTopic; key: TKey }[] = [
  { value: "contact", key: "cform.topic.contact" },
  { value: "referral", key: "cform.topic.referral" },
  { value: "quote_request", key: "cform.topic.quote" },
  { value: "other", key: "cform.topic.other" },
];

const inputClass =
  "w-full rounded-lg border border-navy-200 bg-white px-4 py-3 text-sm text-navy-900 placeholder:text-navy-400 focus:border-navy-500 focus:outline-none focus:ring-2 focus:ring-navy-100";

export default function ContactForm() {
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const topicParam = searchParams.get("topic");
  const initialTopic =
    topicParam && TOPIC_OPTIONS.some((o) => o.value === topicParam)
      ? (topicParam as ContactTopic)
      : "contact";

  const [topic, setTopic] = useState<ContactTopic>(initialTopic);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [subject, setSubject] = useState(() =>
    topicParam === "referral" ? t("cform.referralSubject") : "",
  );
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setSuccess(false);
    try {
      await sendContactMessage({
        topic,
        full_name: fullName.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        subject: subject.trim(),
        message: message.trim(),
      });
      setSuccess(true);
      setFullName("");
      setEmail("");
      setPhone("");
      setMessage("");
    } catch (err) {
      setError(toUserMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="surface space-y-5 p-7 sm:p-8">
      <div>
        <label htmlFor="contact-topic" className="mb-1.5 block text-sm font-semibold text-navy-800">
          {t("cform.topicLabel")}
        </label>
        <select
          id="contact-topic"
          value={topic}
          onChange={(e) => setTopic(e.target.value as ContactTopic)}
          className={inputClass}
        >
          {TOPIC_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {t(option.key)}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="contact-name" className="mb-1.5 block text-sm font-semibold text-navy-800">
            {t("field.name")}
          </label>
          <input
            id="contact-name"
            required
            minLength={2}
            maxLength={200}
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder={t("cform.namePh")}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="contact-email" className="mb-1.5 block text-sm font-semibold text-navy-800">
            {t("field.email")}
          </label>
          <input
            id="contact-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("signup.emailPlaceholder")}
            className={inputClass}
          />
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="contact-phone" className="mb-1.5 block text-sm font-semibold text-navy-800">
            {t("signup.phone")}
          </label>
          <input
            id="contact-phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="06 00 00 00 00"
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="contact-subject" className="mb-1.5 block text-sm font-semibold text-navy-800">
            {t("cform.subject")}
          </label>
          <input
            id="contact-subject"
            required
            minLength={2}
            maxLength={300}
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder={t("cform.subjectPh")}
            className={inputClass}
          />
        </div>
      </div>

      <div>
        <label htmlFor="contact-message" className="mb-1.5 block text-sm font-semibold text-navy-800">
          Message
        </label>
        <textarea
          id="contact-message"
          required
          minLength={10}
          maxLength={5000}
          rows={5}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={t("cform.messagePh")}
          className={inputClass}
        />
      </div>

      {error && (
        <p role="alert" className="rounded-lg border border-flagred-600/30 bg-flagred-50 px-4 py-3 text-sm font-medium text-flagred-700">
          {error}
        </p>
      )}
      {success && (
        <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          {t("cform.success")}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-full bg-navy-800 px-6 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-navy-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
      >
        {pending ? t("cform.submitting") : t("cform.submit")}
      </button>
    </form>
  );
}
