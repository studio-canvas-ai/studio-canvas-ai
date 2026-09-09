import { NextResponse, type NextRequest } from "next/server";
import { getAdminSession } from "@/lib/adminAuth";
import {
  listSupportTickets,
  updateSupportTicket,
} from "@/lib/db/supportTickets";
import type { SupportTicketStatus } from "@/lib/db/types";

export const runtime = "nodejs";

export async function GET() {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  try {
    const tickets = await listSupportTickets();
    return NextResponse.json({ ok: true, tickets });
  } catch (err) {
    console.error("[api/admin/tickets] GET", err);
    return NextResponse.json({ error: "list_failed" }, { status: 500 });
  }
}

type PatchBody = {
  id?: string;
  status?: SupportTicketStatus;
  adminNote?: string;
};

export async function PATCH(request: NextRequest) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const id = String(body.id || "").trim();
  if (!id) {
    return NextResponse.json({ error: "id_required" }, { status: 400 });
  }

  const status = body.status;
  if (
    status != null &&
    status !== "open" &&
    status !== "in_progress" &&
    status !== "resolved"
  ) {
    return NextResponse.json({ error: "status_invalid" }, { status: 400 });
  }

  try {
    const ticket = await updateSupportTicket(id, {
      ...(status ? { status } : {}),
      ...(body.adminNote !== undefined
        ? { adminNote: String(body.adminNote).slice(0, 4000) }
        : {}),
    });
    if (!ticket) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, ticket });
  } catch (err) {
    console.error("[api/admin/tickets] PATCH", err);
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }
}
