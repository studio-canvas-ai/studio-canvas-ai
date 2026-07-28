"use client";

import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useI18n } from "@/components/I18nProvider";
import { listTickets, updateTicket, type SupportTicket } from "@/lib/supportTickets";

export default function AdminPage() {
  const { t } = useI18n();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);

  useEffect(() => {
    setTickets(listTickets());
    const id = setInterval(() => setTickets(listTickets()), 2000);
    return () => clearInterval(id);
  }, []);

  return (
    <main className="relative min-h-screen overflow-hidden">
      <Navbar />
      <section className="section-padding mx-auto max-w-4xl pt-28">
        <h1 className="font-display mb-2 text-3xl font-bold">{t.admin.title}</h1>
        <p className="mb-8 text-sm text-white/50">{t.admin.subtitle}</p>
        {tickets.length === 0 ? (
          <p className="text-sm text-white/40">{t.admin.empty}</p>
        ) : (
          <div className="space-y-4">
            {tickets.map((ticket) => (
              <article key={ticket.id} className="glass-card space-y-3 p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h2 className="text-sm font-medium text-white">{ticket.subject}</h2>
                    <p className="text-xs text-white/40">
                      {ticket.email} · #{ticket.id}
                    </p>
                  </div>
                  <select
                    value={ticket.status}
                    onChange={(e) => {
                      updateTicket(ticket.id, {
                        status: e.target.value as SupportTicket["status"],
                      });
                      setTickets(listTickets());
                    }}
                    className="rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs"
                  >
                    <option value="open">open</option>
                    <option value="in_progress">in_progress</option>
                    <option value="resolved">resolved</option>
                  </select>
                </div>
                <p className="whitespace-pre-wrap text-sm text-white/70">{ticket.body}</p>
                <label className="block text-xs text-white/40">{t.admin.note}</label>
                <textarea
                  defaultValue={ticket.adminNote ?? ""}
                  rows={2}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none"
                  onBlur={(e) => {
                    updateTicket(ticket.id, { adminNote: e.target.value });
                    setTickets(listTickets());
                  }}
                />
              </article>
            ))}
          </div>
        )}
      </section>
      <Footer />
    </main>
  );
}
