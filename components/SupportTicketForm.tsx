"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, Send } from "lucide-react";
import { useI18n } from "@/components/I18nProvider";

export default function SupportTicketForm() {
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [doneId, setDoneId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !subject.trim() || !body.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/support/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          subject: subject.trim(),
          body: body.trim(),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        ticket?: { id?: string };
        error?: string;
      };
      if (!res.ok || !data.ok || !data.ticket?.id) {
        throw new Error(data.error || t.support.error);
      }
      setDoneId(data.ticket.id);
      setEmail("");
      setSubject("");
      setBody("");
    } catch (err) {
      setError(err instanceof Error ? err.message : t.support.error);
    } finally {
      setSubmitting(false);
    }
  };

  if (doneId) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="rounded-2xl border border-glow-emerald/30 bg-glow-emerald/10 p-6 text-center"
      >
        <CheckCircle2 className="mx-auto mb-3 h-8 w-8 text-glow-emerald" />
        <p className="text-sm text-white/80">{t.support.success}</p>
        <p className="mt-1 text-xs text-white/40">#{doneId}</p>
        <button
          type="button"
          className="btn-secondary mt-4 px-4 py-2 text-sm"
          onClick={() => {
            setDoneId(null);
            setError(null);
          }}
        >
          {t.support.another}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="glass-card space-y-4 p-5 sm:p-6">
      <div>
        <label className="mb-1.5 block text-xs text-white/50">{t.support.email}</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={submitting}
          className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm outline-none focus:border-glow-purple/40 disabled:opacity-60"
        />
      </div>
      <div>
        <label className="mb-1.5 block text-xs text-white/50">{t.support.subject}</label>
        <input
          type="text"
          required
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          disabled={submitting}
          className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm outline-none focus:border-glow-purple/40 disabled:opacity-60"
        />
      </div>
      <div>
        <label className="mb-1.5 block text-xs text-white/50">{t.support.body}</label>
        <textarea
          required
          rows={5}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          disabled={submitting}
          className="w-full resize-y rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm outline-none focus:border-glow-purple/40 disabled:opacity-60"
        />
      </div>
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      <button
        type="submit"
        disabled={submitting}
        className="btn-primary w-full py-2.5 text-sm disabled:opacity-60"
      >
        {submitting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Send className="h-4 w-4" />
        )}
        {submitting ? t.support.submitting : t.support.submit}
      </button>
    </form>
  );
}
