"use client";

import { useState } from "react";
import { CheckCircle2, Send } from "lucide-react";
import { useI18n } from "@/components/I18nProvider";
import { createTicket } from "@/lib/supportTickets";

export default function SupportTicketForm() {
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [doneId, setDoneId] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !subject.trim() || !body.trim()) return;
    const ticket = createTicket({ email, subject, body });
    setDoneId(ticket.id);
    setSubject("");
    setBody("");
  };

  if (doneId) {
    return (
      <div className="rounded-2xl border border-glow-emerald/30 bg-glow-emerald/10 p-6 text-center">
        <CheckCircle2 className="mx-auto mb-3 h-8 w-8 text-glow-emerald" />
        <p className="text-sm text-white/80">{t.support.success}</p>
        <p className="mt-1 text-xs text-white/40">#{doneId}</p>
        <button
          type="button"
          className="btn-secondary mt-4 px-4 py-2 text-sm"
          onClick={() => setDoneId(null)}
        >
          {t.support.another}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="glass-card space-y-4 p-5 sm:p-6">
      <div>
        <label className="mb-1.5 block text-xs text-white/50">{t.support.email}</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm outline-none focus:border-glow-purple/40"
        />
      </div>
      <div>
        <label className="mb-1.5 block text-xs text-white/50">{t.support.subject}</label>
        <input
          type="text"
          required
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm outline-none focus:border-glow-purple/40"
        />
      </div>
      <div>
        <label className="mb-1.5 block text-xs text-white/50">{t.support.body}</label>
        <textarea
          required
          rows={5}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="w-full resize-y rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm outline-none focus:border-glow-purple/40"
        />
      </div>
      <button type="submit" className="btn-primary w-full py-2.5 text-sm">
        <Send className="h-4 w-4" />
        {t.support.submit}
      </button>
    </form>
  );
}
