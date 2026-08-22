"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/components/I18nProvider";
import type { SupportTicket } from "@/lib/supportTickets";
import type { AuthProviderId, PlanId } from "@/lib/db/types";

type AdminUserRow = {
  id: string;
  email: string | null;
  name: string | null;
  provider: AuthProviderId;
  planId: PlanId;
  credits: number;
  createdAt: number;
};

function formatSignedUp(ts: number, locale: string) {
  try {
    return new Date(ts).toLocaleString(locale === "kr" ? "ko-KR" : "en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return new Date(ts).toISOString();
  }
}

export default function AdminPageClient() {
  const { t, locale } = useI18n();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(true);
  const [ticketsError, setTicketsError] = useState<string | null>(null);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersError, setUsersError] = useState<string | null>(null);

  const loadTickets = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/tickets", {
        cache: "no-store",
        credentials: "same-origin",
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        tickets?: SupportTicket[];
        error?: string;
      };
      if (!res.ok || !data.ok || !Array.isArray(data.tickets)) {
        throw new Error(data.error || "tickets_failed");
      }
      setTickets(data.tickets);
      setTicketsError(null);
    } catch (err) {
      setTicketsError(err instanceof Error ? err.message : "tickets_failed");
    } finally {
      setTicketsLoading(false);
    }
  }, []);

  const patchTicket = useCallback(
    async (
      id: string,
      patch: Partial<Pick<SupportTicket, "status" | "adminNote">>
    ) => {
      const res = await fetch("/api/admin/tickets", {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...patch }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        ticket?: SupportTicket;
        error?: string;
      };
      if (!res.ok || !data.ok || !data.ticket) {
        throw new Error(data.error || "update_failed");
      }
      setTickets((prev) => prev.map((t) => (t.id === id ? data.ticket! : t)));
    },
    []
  );

  const loadUsers = useCallback(async () => {
    setUsersLoading(true);
    setUsersError(null);
    try {
      const res = await fetch("/api/admin/users", { cache: "no-store" });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        users?: AdminUserRow[];
        error?: string;
      };
      if (!res.ok || !data.ok || !Array.isArray(data.users)) {
        throw new Error(data.error || t.admin.membersError);
      }
      setUsers(data.users);
    } catch (err) {
      setUsers([]);
      setUsersError(err instanceof Error ? err.message : t.admin.membersError);
    } finally {
      setUsersLoading(false);
    }
  }, [t.admin.membersError]);

  useEffect(() => {
    void loadTickets();
    const id = setInterval(() => void loadTickets(), 4000);
    return () => clearInterval(id);
  }, [loadTickets]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  return (
    <section className="section-padding mx-auto max-w-6xl space-y-12 pt-28">
      <header>
        <h1 className="font-display mb-2 text-3xl font-bold">{t.admin.title}</h1>
        <p className="text-sm text-white/50">{t.admin.subtitle}</p>
        <p className="mt-3 text-sm text-white/40">
          <Link href="/admin/promotions" className="underline underline-offset-2 hover:text-white/70">
            Promotions
          </Link>
        </p>
      </header>

      <div>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-white">{t.admin.membersTitle}</h2>
            <p className="mt-1 text-sm text-white/50">{t.admin.membersSubtitle}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void loadUsers()}
              className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-white/70 transition hover:bg-white/10 hover:text-white"
            >
              Refresh
            </button>
            <button
              type="button"
              onClick={() => {
                void (async () => {
                  await fetch("/api/admin/logout", {
                    method: "POST",
                    credentials: "same-origin",
                  });
                  window.location.href = "/admin";
                })();
              }}
              className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-white/70 transition hover:bg-white/10 hover:text-white"
            >
              Log out
            </button>
          </div>
        </div>

        <p className="mb-4 text-sm font-medium text-glow-emerald">
          {t.admin.membersTotal.replace("{count}", String(users.length))}
        </p>

        {usersLoading ? (
          <p className="text-sm text-white/40">{t.admin.membersLoading}</p>
        ) : usersError ? (
          <p className="text-sm text-red-300">{usersError}</p>
        ) : users.length === 0 ? (
          <p className="text-sm text-white/40">{t.admin.membersEmpty}</p>
        ) : (
          <div className="glass-card overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-xs uppercase tracking-wide text-white/45">
                  <th className="px-4 py-3 font-medium">{t.admin.colEmail}</th>
                  <th className="px-4 py-3 font-medium">{t.admin.colName}</th>
                  <th className="px-4 py-3 font-medium">{t.admin.colProvider}</th>
                  <th className="px-4 py-3 font-medium">{t.admin.colPlan}</th>
                  <th className="px-4 py-3 font-medium">{t.admin.colCredits}</th>
                  <th className="px-4 py-3 font-medium">{t.admin.colSignedUp}</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr
                    key={user.id}
                    className="border-b border-white/5 text-white/80 last:border-0"
                  >
                    <td className="max-w-[220px] truncate px-4 py-3 font-mono text-xs text-white/90">
                      {user.email || "—"}
                    </td>
                    <td className="px-4 py-3">{user.name || "—"}</td>
                    <td className="px-4 py-3 capitalize">{user.provider}</td>
                    <td className="px-4 py-3 capitalize">{user.planId}</td>
                    <td className="px-4 py-3 tabular-nums">{user.credits}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-white/55">
                      {formatSignedUp(user.createdAt, locale)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-xl font-semibold text-white">{t.admin.ticketsTitle}</h2>
          <button
            type="button"
            onClick={() => void loadTickets()}
            className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-white/70 transition hover:bg-white/10 hover:text-white"
          >
            Refresh
          </button>
        </div>
        {ticketsLoading && tickets.length === 0 ? (
          <p className="text-sm text-white/40">Loading…</p>
        ) : ticketsError && tickets.length === 0 ? (
          <p className="text-sm text-red-300">{ticketsError}</p>
        ) : tickets.length === 0 ? (
          <p className="text-sm text-white/40">{t.admin.empty}</p>
        ) : (
          <div className="space-y-4">
            {tickets.map((ticket) => (
              <article key={ticket.id} className="glass-card space-y-3 p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-medium text-white">{ticket.subject}</h3>
                    <p className="text-xs text-white/40">
                      {ticket.email} · #{ticket.id}
                    </p>
                  </div>
                  <select
                    value={ticket.status}
                    onChange={(e) => {
                      void patchTicket(ticket.id, {
                        status: e.target.value as SupportTicket["status"],
                      }).catch((err) => {
                        setTicketsError(
                          err instanceof Error ? err.message : "update_failed"
                        );
                      });
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
                    void patchTicket(ticket.id, { adminNote: e.target.value }).catch(
                      (err) => {
                        setTicketsError(
                          err instanceof Error ? err.message : "update_failed"
                        );
                      }
                    );
                  }}
                />
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
