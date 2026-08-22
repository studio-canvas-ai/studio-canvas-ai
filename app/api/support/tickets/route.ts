import { NextResponse, type NextRequest } from "next/server";
import { isValidEmailFormat } from "@/lib/authValidation";
import { createSupportTicket } from "@/lib/db/supportTickets";
import { clientIp, rateLimit } from "@/lib/rateLimit";
import { sendSupportTicketNotifyEmail } from "@/lib/supportNotifyEmail";

export const runtime = "nodejs";

type Body = {
  email?: string;
  subject?: string;
  body?: string;
};

/**
 * Public: submit a 1:1 support ticket.
 * Persists to R2 (or local DB), then emails CS inbox.
 */
export async function POST(request: NextRequest) {
  const ip = clientIp(request);
  const limited = rateLimit({
    key: `support:create:${ip}`,
    limit: 8,
    windowMs: 60 * 60 * 1000,
  });
  if (!limited.ok) {
    return NextResponse.json(
      { error: "rate_limited", code: "rate_limited" },
      { status: 429 }
    );
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const email = String(body.email || "")
    .trim()
    .toLowerCase();
  const subject = String(body.subject || "").trim();
  const message = String(body.body || "").trim();

  if (!email || !isValidEmailFormat(email)) {
    return NextResponse.json({ error: "email_invalid", code: "email_invalid" }, { status: 400 });
  }
  if (!subject) {
    return NextResponse.json(
      { error: "subject_required", code: "subject_required" },
      { status: 400 }
    );
  }
  if (!message) {
    return NextResponse.json({ error: "body_required", code: "body_required" }, { status: 400 });
  }

  try {
    const ticket = await createSupportTicket({ email, subject, body: message });

    let emailSent = false;
    let emailError: string | undefined;
    try {
      const mail = await sendSupportTicketNotifyEmail(ticket);
      emailSent = mail.ok;
      emailError = mail.error;
      if (!mail.ok) {
        console.warn("[api/support/tickets] notify email failed:", mail.error);
      }
    } catch (err) {
      emailError = err instanceof Error ? err.message : "email_failed";
      console.warn("[api/support/tickets] notify email threw:", err);
    }

    return NextResponse.json({
      ok: true,
      ticket: {
        id: ticket.id,
        email: ticket.email,
        subject: ticket.subject,
        status: ticket.status,
        createdAt: ticket.createdAt,
      },
      emailSent,
      ...(emailError && !emailSent ? { emailError } : {}),
    });
  } catch (err) {
    console.error("[api/support/tickets]", err);
    return NextResponse.json({ error: "create_failed" }, { status: 500 });
  }
}
