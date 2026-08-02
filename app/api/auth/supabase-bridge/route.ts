import { NextResponse, type NextRequest } from "next/server";
import { createSessionFromSupabaseAccessToken } from "@/lib/createSupabaseSession";

/**
 * Establishes a NextAuth JWT session from a Supabase access token.
 * Avoids client-side `signIn("supabase")` which requires a CSRF double-submit
 * cookie that often goes missing after the OAuth redirect chain.
 */
export async function POST(request: NextRequest) {
  let accessToken = "";
  const contentType = request.headers.get("content-type") || "";

  try {
    if (contentType.includes("application/json")) {
      const body = (await request.json()) as { accessToken?: string };
      accessToken = String(body.accessToken || "").trim();
    } else {
      const form = await request.formData();
      accessToken = String(form.get("accessToken") || "").trim();
    }
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!accessToken) {
    return NextResponse.json({ error: "Missing accessToken" }, { status: 400 });
  }

  try {
    const session = await Promise.race([
      createSessionFromSupabaseAccessToken(accessToken),
      new Promise<never>((_, reject) => {
        setTimeout(
          () => reject(new Error("Session creation timed out after 12s")),
          12_000
        );
      }),
    ]);
    const response = NextResponse.json({
      ok: true,
      user: session.user,
    });
    response.cookies.set(session.cookieName, session.token, session.cookieOptions);
    return response;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Bridge failed";
    console.error("[auth/supabase-bridge]", message, err);
    const status =
      message.includes("Invalid Supabase") || message.includes("access token")
        ? 401
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
