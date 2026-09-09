import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/adminAuth";
import { listRegisteredProfilesForAdmin } from "@/lib/supabase/profile";

export const runtime = "nodejs";

/**
 * Admin: registered member directory from Supabase public.profiles
 * (terms_agreed = true only). Requires dedicated admin session + service role.
 */
export async function GET() {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  try {
    const users = await listRegisteredProfilesForAdmin();
    return NextResponse.json({
      ok: true,
      total: users.length,
      users: users.map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        provider: u.provider,
        planId: u.planId,
        credits: u.credits,
        createdAt: u.createdAt,
        termsAgreed: u.termsAgreed,
      })),
    });
  } catch (err) {
    console.error("[api/admin/users]", err);
    const message = err instanceof Error ? err.message : "list_failed";
    const status = message.includes("SUPABASE_SERVICE_ROLE_KEY") ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
