import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { resolveAppUser } from "@/lib/resolveAppUser";
import {
  authSessionCookieName,
  useSecureAuthCookies,
} from "@/lib/authCookies";
import { requireAuthSecret } from "@/lib/authSecret";
import { collectUserStorageAliases } from "@/lib/studioStore/userAliases";
import {
  loadUserSavedForms,
  parseSavedFormPayload,
  saveUserSavedForms,
  USER_SAVED_FORM_SCREENS,
  type SavedFormScreenId,
} from "@/lib/canvas/userSavedFormsStore";

export const runtime = "nodejs";
export const maxDuration = 60;

function isScreenId(v: unknown): v is SavedFormScreenId {
  return (
    typeof v === "string" &&
    (USER_SAVED_FORM_SCREENS as readonly string[]).includes(v)
  );
}

async function supabaseUserIdFrom(req: Request): Promise<string | null> {
  try {
    const token = await getToken({
      req,
      secret: requireAuthSecret(),
      secureCookie: useSecureAuthCookies(),
      cookieName: authSessionCookieName(),
    });
    return typeof token?.supabaseUserId === "string"
      ? token.supabaseUserId
      : typeof token?.providerAccountId === "string" &&
          /^[0-9a-f-]{36}$/i.test(token.providerAccountId)
        ? token.providerAccountId
        : null;
  } catch {
    return null;
  }
}

function screenFromRequest(req: Request, body?: Record<string, unknown>) {
  const url = new URL(req.url);
  const fromQuery = url.searchParams.get("namespace") || url.searchParams.get("screen");
  const fromBody = body?.namespace ?? body?.screenId;
  const raw = fromQuery || fromBody;
  return isScreenId(raw) ? raw : null;
}

/** GET — SCA recent drawer for the signed-in account (any social provider). */
export async function GET(req: Request) {
  const resolved = await resolveAppUser(req);
  if (!resolved.ok) {
    return NextResponse.json(
      { error: resolved.error, ok: false, entries: [] },
      {
        status: resolved.status,
        headers: { "Cache-Control": "private, no-store" },
      }
    );
  }

  const screenId = screenFromRequest(req);
  if (!screenId) {
    return NextResponse.json(
      { error: "invalid_namespace", ok: false, entries: [] },
      { status: 400 }
    );
  }

  const aliases = await collectUserStorageAliases(req, resolved.user);
  const entries = await loadUserSavedForms(
    [...new Set([resolved.user.id, ...aliases])],
    screenId
  );

  return NextResponse.json(
    { ok: true, namespace: screenId, entries },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}

/** PUT — replace/merge the account drawer for one screen. */
export async function PUT(req: Request) {
  const resolved = await resolveAppUser(req);
  if (!resolved.ok) {
    return NextResponse.json(
      { error: resolved.error, ok: false },
      { status: resolved.status }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_json", ok: false }, { status: 400 });
  }

  const screenId = screenFromRequest(req, body);
  if (!screenId) {
    return NextResponse.json(
      { error: "invalid_namespace", ok: false },
      { status: 400 }
    );
  }

  const incoming = parseSavedFormPayload(body.entries ?? body.payload);
  const supabaseUserId = await supabaseUserIdFrom(req);
  const entries = await saveUserSavedForms({
    canonicalUserId: resolved.user.id,
    supabaseUserId,
    screenId,
    entries: incoming,
  });

  return NextResponse.json({ ok: true, namespace: screenId, entries });
}

/** POST — same as PUT (clients that prefer POST). */
export async function POST(req: Request) {
  return PUT(req);
}
