import { auth } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isPrintSmartFormAdminEmail } from "@/lib/printSmartForm";

export type PrintSmartFormAccess = "allow" | "deny" | "unknown";

async function collectSessionEmails(): Promise<string[]> {
  const emails: string[] = [];

  try {
    const session = await auth();
    if (session?.user?.email) emails.push(session.user.email);
  } catch {
    /* ignore */
  }

  if (!isSupabaseConfigured()) return emails;

  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getUser();
    if (data.user?.email) emails.push(data.user.email);
  } catch {
    /* ignore */
  }

  return emails;
}

/** Server-side gate: allow / deny when identity is known; unknown defers to the client. */
export async function resolvePrintSmartFormAccess(): Promise<PrintSmartFormAccess> {
  const emails = await collectSessionEmails();
  if (emails.some((email) => isPrintSmartFormAdminEmail(email))) return "allow";
  if (emails.length > 0) return "deny";
  return "unknown";
}
