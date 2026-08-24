"use client";

/**
 * Screen badge for /auth/* routes (no CreditsProvider).
 * Uses NextAuth session email against the privileged admin allow-list.
 */

import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { isPrivilegedAdminEmail } from "@/lib/unlimitedAccount";
import { resolveScreenId } from "@/lib/screenRegistry";

export default function ScreenBadgeAuth() {
  const pathname = usePathname() || "/";
  const { data: session, status } = useSession();

  if (status !== "authenticated") return null;

  const email =
    typeof session?.user?.email === "string" ? session.user.email : null;
  if (!isPrivilegedAdminEmail(email)) return null;

  const screenId = resolveScreenId(pathname);

  return (
    <div
      role="status"
      aria-label={screenId}
      data-screen-id={screenId}
      className="pointer-events-none fixed right-3 top-3 select-none rounded px-2 py-1 text-[11px] font-bold tracking-wide text-white shadow-lg"
      style={{
        zIndex: 99999,
        backgroundColor: "#DC2626",
      }}
    >
      {screenId}
    </div>
  );
}
