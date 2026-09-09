import { getDb, newId, withDbLock } from "@/lib/db/store";
import type { SupportTicket, SupportTicketStatus } from "@/lib/db/types";
import {
  createR2Client,
  getR2Config,
  getR2Object,
  isR2Configured,
  putR2Object,
} from "@/lib/r2";

const R2_KEY = "admin/support-tickets.json";
const MAX_TICKETS = 2000;

type TicketsFile = {
  tickets: SupportTicket[];
  updatedAt: number;
};

type GlobalTickets = typeof globalThis & {
  __scaSupportTicketsQueue?: Promise<unknown>;
};

const g = globalThis as GlobalTickets;

function normalizeTicket(raw: Partial<SupportTicket> & { id?: string }): SupportTicket | null {
  if (!raw?.id || typeof raw.email !== "string" || typeof raw.subject !== "string") {
    return null;
  }
  const status: SupportTicketStatus =
    raw.status === "in_progress" || raw.status === "resolved" ? raw.status : "open";
  const createdAt = typeof raw.createdAt === "number" ? raw.createdAt : Date.now();
  return {
    id: raw.id,
    email: raw.email.trim(),
    subject: raw.subject.trim(),
    body: typeof raw.body === "string" ? raw.body : "",
    status,
    createdAt,
    updatedAt: typeof raw.updatedAt === "number" ? raw.updatedAt : createdAt,
    adminNote: typeof raw.adminNote === "string" ? raw.adminNote : undefined,
  };
}

function sortTickets(tickets: SupportTicket[]): SupportTicket[] {
  return [...tickets].sort((a, b) => b.createdAt - a.createdAt);
}

async function loadFromR2(): Promise<SupportTicket[]> {
  const config = getR2Config();
  if (!config) return [];
  const client = createR2Client(config);
  const raw = await getR2Object(client, config.bucketName, R2_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw.toString("utf8")) as TicketsFile | SupportTicket[];
    const list = Array.isArray(parsed) ? parsed : parsed.tickets;
    if (!Array.isArray(list)) return [];
    return sortTickets(
      list.map((t) => normalizeTicket(t)).filter((t): t is SupportTicket => t != null)
    );
  } catch {
    return [];
  }
}

async function saveToR2(tickets: SupportTicket[]): Promise<void> {
  const config = getR2Config();
  if (!config) throw new Error("r2_not_configured");
  const client = createR2Client(config);
  const payload: TicketsFile = {
    tickets: sortTickets(tickets).slice(0, MAX_TICKETS),
    updatedAt: Date.now(),
  };
  await putR2Object(
    client,
    config.bucketName,
    R2_KEY,
    Buffer.from(JSON.stringify(payload)),
    "application/json"
  );
}

async function withR2TicketsLock<T>(
  fn: (tickets: SupportTicket[]) => Promise<T> | T
): Promise<T> {
  let result!: T;
  g.__scaSupportTicketsQueue = (g.__scaSupportTicketsQueue ?? Promise.resolve()).then(
    async () => {
      const tickets = await loadFromR2();
      result = await fn(tickets);
    }
  );
  await g.__scaSupportTicketsQueue;
  return result;
}

export async function listSupportTickets(): Promise<SupportTicket[]> {
  if (isR2Configured()) {
    return loadFromR2();
  }
  const db = getDb();
  return sortTickets(db.supportTickets ?? []);
}

export async function createSupportTicket(input: {
  email: string;
  subject: string;
  body: string;
}): Promise<SupportTicket> {
  const now = Date.now();
  const ticket: SupportTicket = {
    id: newId("tkt"),
    email: input.email.trim().toLowerCase(),
    subject: input.subject.trim().slice(0, 200),
    body: input.body.trim().slice(0, 8000),
    status: "open",
    createdAt: now,
    updatedAt: now,
  };

  if (isR2Configured()) {
    await withR2TicketsLock(async (tickets) => {
      await saveToR2([ticket, ...tickets]);
    });
    return ticket;
  }

  await withDbLock((db) => {
    db.supportTickets = [ticket, ...(db.supportTickets ?? [])].slice(0, MAX_TICKETS);
  });
  return ticket;
}

export async function updateSupportTicket(
  id: string,
  patch: Partial<Pick<SupportTicket, "status" | "adminNote">>
): Promise<SupportTicket | null> {
  if (isR2Configured()) {
    return withR2TicketsLock(async (tickets) => {
      let updated: SupportTicket | null = null;
      const next = tickets.map((t) => {
        if (t.id !== id) return t;
        updated = {
          ...t,
          ...(patch.status ? { status: patch.status } : {}),
          ...(patch.adminNote !== undefined ? { adminNote: patch.adminNote } : {}),
          updatedAt: Date.now(),
        };
        return updated;
      });
      if (!updated) return null;
      await saveToR2(next);
      return updated;
    });
  }

  return withDbLock((db) => {
    let updated: SupportTicket | null = null;
    db.supportTickets = (db.supportTickets ?? []).map((t) => {
      if (t.id !== id) return t;
      updated = {
        ...t,
        ...(patch.status ? { status: patch.status } : {}),
        ...(patch.adminNote !== undefined ? { adminNote: patch.adminNote } : {}),
        updatedAt: Date.now(),
      };
      return updated;
    });
    return updated;
  });
}
