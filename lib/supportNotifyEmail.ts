import type { SupportTicket } from "@/lib/db/types";

export const DEFAULT_SUPPORT_NOTIFY_TO = "studiocanvas.cs@gmail.com";

export function getSupportNotifyTo(): string {
  return (
    process.env.SUPPORT_NOTIFY_TO?.trim() ||
    process.env.CS_EMAIL?.trim() ||
    DEFAULT_SUPPORT_NOTIFY_TO
  );
}

export function getSupportEmailFrom(): string {
  return (
    process.env.SUPPORT_EMAIL_FROM?.trim() ||
    process.env.EMAIL_FROM?.trim() ||
    "Studio Canvas AI <onboarding@resend.dev>"
  );
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildBodies(ticket: SupportTicket): { text: string; html: string } {
  const when = new Date(ticket.createdAt).toISOString();
  const text = [
    "새 1:1 고객센터 문의가 접수되었습니다.",
    "",
    `티켓 ID: ${ticket.id}`,
    `접수 시각: ${when}`,
    `회신 이메일: ${ticket.email}`,
    `제목: ${ticket.subject}`,
    "",
    "문의 내용:",
    ticket.body,
    "",
    "관리자 대시보드: /admin",
  ].join("\n");

  const html = `
    <div style="font-family:system-ui,-apple-system,sans-serif;line-height:1.5;color:#111">
      <h2 style="margin:0 0 12px">새 1:1 고객센터 문의</h2>
      <p style="margin:0 0 8px"><strong>티켓 ID:</strong> ${escapeHtml(ticket.id)}</p>
      <p style="margin:0 0 8px"><strong>접수 시각:</strong> ${escapeHtml(when)}</p>
      <p style="margin:0 0 8px"><strong>회신 이메일:</strong> ${escapeHtml(ticket.email)}</p>
      <p style="margin:0 0 8px"><strong>제목:</strong> ${escapeHtml(ticket.subject)}</p>
      <hr style="border:none;border-top:1px solid #ddd;margin:16px 0" />
      <pre style="white-space:pre-wrap;font-family:inherit;margin:0">${escapeHtml(ticket.body)}</pre>
    </div>
  `.trim();

  return { text, html };
}

async function sendViaResend(ticket: SupportTicket): Promise<{ ok: true } | { ok: false; error: string }> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) return { ok: false, error: "resend_not_configured" };

  const { text, html } = buildBodies(ticket);
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: getSupportEmailFrom(),
      to: [getSupportNotifyTo()],
      reply_to: ticket.email,
      subject: `[Studio Canvas AI 문의] ${ticket.subject}`,
      text,
      html,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    return { ok: false, error: `resend_${res.status}:${detail.slice(0, 300)}` };
  }
  return { ok: true };
}

async function sendViaSendGrid(ticket: SupportTicket): Promise<{ ok: true } | { ok: false; error: string }> {
  const apiKey = process.env.SENDGRID_API_KEY?.trim();
  if (!apiKey) return { ok: false, error: "sendgrid_not_configured" };

  const { text, html } = buildBodies(ticket);
  const from = getSupportEmailFrom();
  const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      personalizations: [
        {
          to: [{ email: getSupportNotifyTo() }],
          subject: `[Studio Canvas AI 문의] ${ticket.subject}`,
        },
      ],
      from: parseFrom(from),
      reply_to: { email: ticket.email },
      content: [
        { type: "text/plain", value: text },
        { type: "text/html", value: html },
      ],
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    return { ok: false, error: `sendgrid_${res.status}:${detail.slice(0, 300)}` };
  }
  return { ok: true };
}

function parseFrom(from: string): { email: string; name?: string } {
  const match = from.match(/^(.*?)<([^>]+)>$/);
  if (match) {
    return { name: match[1].trim().replace(/^"|"$/g, "") || undefined, email: match[2].trim() };
  }
  return { email: from.trim() };
}

/**
 * Notify CS inbox when a support ticket is created.
 * Prefers Resend, then SendGrid. Returns soft-failure detail if not configured.
 */
export async function sendSupportTicketNotifyEmail(
  ticket: SupportTicket
): Promise<{ ok: boolean; provider?: string; error?: string }> {
  if (process.env.RESEND_API_KEY?.trim()) {
    const result = await sendViaResend(ticket);
    if (result.ok) return { ok: true, provider: "resend" };
    return { ok: false, provider: "resend", error: result.error };
  }
  if (process.env.SENDGRID_API_KEY?.trim()) {
    const result = await sendViaSendGrid(ticket);
    if (result.ok) return { ok: true, provider: "sendgrid" };
    return { ok: false, provider: "sendgrid", error: result.error };
  }
  return { ok: false, error: "email_not_configured" };
}
