import { loadJson, saveJson, STORAGE_KEYS } from "@/lib/storage";

export type SupportTicket = {
  id: string;
  email: string;
  subject: string;
  body: string;
  status: "open" | "in_progress" | "resolved";
  createdAt: number;
  updatedAt: number;
  adminNote?: string;
};

export function listTickets(): SupportTicket[] {
  return loadJson<SupportTicket[]>(STORAGE_KEYS.tickets, []).sort(
    (a, b) => b.createdAt - a.createdAt
  );
}

export function createTicket(input: {
  email: string;
  subject: string;
  body: string;
}): SupportTicket {
  const now = Date.now();
  const ticket: SupportTicket = {
    id: `tkt-${now}`,
    email: input.email.trim(),
    subject: input.subject.trim(),
    body: input.body.trim(),
    status: "open",
    createdAt: now,
    updatedAt: now,
  };
  const list = [ticket, ...listTickets()];
  saveJson(STORAGE_KEYS.tickets, list);
  return ticket;
}

export function updateTicket(
  id: string,
  patch: Partial<Pick<SupportTicket, "status" | "adminNote">>
) {
  const list = listTickets().map((t) =>
    t.id === id ? { ...t, ...patch, updatedAt: Date.now() } : t
  );
  saveJson(STORAGE_KEYS.tickets, list);
  return list.find((t) => t.id === id) ?? null;
}
