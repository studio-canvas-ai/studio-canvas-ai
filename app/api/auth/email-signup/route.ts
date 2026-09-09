import { NextResponse, type NextRequest } from "next/server";
import {
  isValidEmailFormat,
  validatePasswordStrength,
} from "@/lib/authValidation";
import { createSupabaseServiceClient, getSupabaseServiceRoleKey } from "@/lib/supabase/service";
import { getSupabaseUrl } from "@/lib/supabase/config";

export const runtime = "nodejs";

type Body = {
  email?: string;
  password?: string;
  name?: string;
};

/**
 * Create an email/password user with email already confirmed (no inbox wait).
 * Used for immediate activation after [회원가입] — required for payment review flows.
 * Client must follow with signInWithPassword to establish browser Supabase cookies.
 */
export async function POST(request: NextRequest) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const email = String(body.email || "")
    .trim()
    .toLowerCase();
  const password = String(body.password || "");
  const name = String(body.name || "")
    .trim()
    .slice(0, 80);

  if (!email) {
    return NextResponse.json({ error: "email_required", code: "email_required" }, { status: 400 });
  }
  if (!isValidEmailFormat(email)) {
    return NextResponse.json({ error: "email_invalid", code: "email_invalid" }, { status: 400 });
  }
  if (!password) {
    return NextResponse.json(
      { error: "password_required", code: "password_required" },
      { status: 400 }
    );
  }
  if (password.length < 8 || !validatePasswordStrength(password)) {
    return NextResponse.json(
      { error: "password_weak", code: "password_weak" },
      { status: 400 }
    );
  }
  if (!name) {
    return NextResponse.json({ error: "name_required", code: "name_required" }, { status: 400 });
  }

  const admin = createSupabaseServiceClient();
  if (!admin) {
    return NextResponse.json(
      {
        error: "SUPABASE_SERVICE_ROLE_KEY is not configured",
        code: "service_unavailable",
      },
      { status: 503 }
    );
  }

  try {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        name,
        full_name: name,
      },
    });

    if (!error && data.user) {
      return NextResponse.json({
        ok: true,
        userId: data.user.id,
        email: data.user.email,
      });
    }

    const message = error?.message || "createUser failed";
    const lower = message.toLowerCase();
    const already =
      lower.includes("already") ||
      lower.includes("registered") ||
      lower.includes("exists") ||
      error?.code === "email_exists" ||
      error?.status === 422;

    if (already) {
      // Unconfirmed leftover from prior signup — confirm + refresh password/metadata.
      const recovered = await recoverUnconfirmedUser(admin, email, password, name);
      if (recovered === "exists") {
        return NextResponse.json(
          { error: "email_exists", code: "email_exists" },
          { status: 409 }
        );
      }
      if (recovered === "ok") {
        return NextResponse.json({ ok: true, recovered: true, email });
      }
      return NextResponse.json(
        { error: "email_exists", code: "email_exists" },
        { status: 409 }
      );
    }

    console.error("[auth/email-signup]", message);
    return NextResponse.json(
      { error: message, code: "auth_error" },
      { status: 500 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "email signup failed";
    console.error("[auth/email-signup]", message, err);
    // Never surface mail-provider failures as a hard block if the user was created.
    return NextResponse.json({ error: message, code: "auth_error" }, { status: 500 });
  }
}

type AdminClient = NonNullable<ReturnType<typeof createSupabaseServiceClient>>;

async function findUserIdByEmail(
  admin: AdminClient,
  email: string
): Promise<{ id: string; confirmed: boolean } | null> {
  try {
    // GoTrue admin list supports email filter via REST.
    const url = getSupabaseUrl()?.replace(/\/$/, "");
    const key = getSupabaseServiceRoleKey();
    if (url && key) {
      const res = await fetch(
        `${url}/auth/v1/admin/users?email=${encodeURIComponent(email)}`,
        {
          headers: {
            Authorization: `Bearer ${key}`,
            apikey: key,
          },
          cache: "no-store",
        }
      );
      if (res.ok) {
        const json = (await res.json()) as {
          users?: Array<{
            id: string;
            email?: string;
            email_confirmed_at?: string | null;
          }>;
          id?: string;
          email_confirmed_at?: string | null;
        };
        const users = Array.isArray(json.users)
          ? json.users
          : json.id
            ? [
                {
                  id: json.id,
                  email,
                  email_confirmed_at: json.email_confirmed_at,
                },
              ]
            : [];
        const match = users.find(
          (u) => (u.email || "").toLowerCase() === email.toLowerCase()
        );
        if (match?.id) {
          return {
            id: match.id,
            confirmed: Boolean(match.email_confirmed_at),
          };
        }
      }
    }
  } catch (err) {
    console.warn("[auth/email-signup] email lookup failed", err);
  }

  // Fallback: scan first pages (small projects / review accounts).
  try {
    for (let page = 1; page <= 5; page++) {
      const { data, error } = await admin.auth.admin.listUsers({
        page,
        perPage: 200,
      });
      if (error) break;
      const match = data.users.find(
        (u) => (u.email || "").toLowerCase() === email.toLowerCase()
      );
      if (match) {
        return {
          id: match.id,
          confirmed: Boolean(match.email_confirmed_at),
        };
      }
      if (data.users.length < 200) break;
    }
  } catch (err) {
    console.warn("[auth/email-signup] listUsers fallback failed", err);
  }

  return null;
}

async function recoverUnconfirmedUser(
  admin: AdminClient,
  email: string,
  password: string,
  name: string
): Promise<"ok" | "exists" | "fail"> {
  try {
    const found = await findUserIdByEmail(admin, email);
    if (!found) return "exists";
    if (found.confirmed) return "exists";

    const { error } = await admin.auth.admin.updateUserById(found.id, {
      password,
      email_confirm: true,
      user_metadata: { name, full_name: name },
    });
    if (error) {
      console.warn("[auth/email-signup] confirm existing failed", error.message);
      return "fail";
    }
    return "ok";
  } catch (err) {
    console.warn("[auth/email-signup] recover failed", err);
    return "fail";
  }
}
