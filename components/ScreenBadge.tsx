"use client";

/**
 * Admin-only permanent Screen ID badge (top-right).
 * Visible solely for privileged admin emails — never for normal users.
 */

import { usePathname } from "next/navigation";
import { useCredits } from "@/components/CreditsProvider";
import { isPrivilegedAdminEmail } from "@/lib/unlimitedAccount";
import { resolveScreenId } from "@/lib/screenRegistry";

export default function ScreenBadge() {
  const pathname = usePathname() || "/";
  const { isAdmin, authUser } = useCredits();

  const email = authUser?.email ?? null;
  const allowed =
    isAdmin || isPrivilegedAdminEmail(email);

  if (!allowed) return null;

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
