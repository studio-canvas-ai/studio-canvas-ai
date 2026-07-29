import { auth } from "@/lib/auth";

function adminEmails() {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export async function getAdminSession() {
  const session = await auth();
  const email = session?.user?.email?.toLowerCase();
  const authProvider = session?.authProvider;
  const credentialsAdminAllowed =
    process.env.ALLOW_CREDENTIALS_ADMIN === "true";
  if (
    !email ||
    !authProvider ||
    !adminEmails().includes(email) ||
    (authProvider === "credentials" && !credentialsAdminAllowed)
  ) {
    return null;
  }
  return session;
}

export async function requireAdmin() {
  const session = await getAdminSession();
  if (!session) throw new Error("ADMIN_FORBIDDEN");
  return session;
}
