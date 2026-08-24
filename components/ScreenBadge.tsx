"use client";

/**
 * Admin-only permanent Screen ID badge (top-right).
 * Visible solely for privileged admin emails — never for normal users.
 * Resolves stepped wizard URLs via sessionStorage wizardStep (same path, distinct IDs).
 */

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useCredits } from "@/components/CreditsProvider";
import { isPrivilegedAdminEmail } from "@/lib/unlimitedAccount";
import {
  readInternalScreenStep,
  resolveScreenId,
} from "@/lib/screenRegistry";

export default function ScreenBadge() {
  const pathname = usePathname() || "/";
  const { isAdmin, authUser } = useCredits();
  const [step, setStep] = useState<number | undefined>(undefined);

  useEffect(() => {
    const sync = () => setStep(readInternalScreenStep(pathname));
    sync();
    const id = window.setInterval(sync, 400);
    return () => window.clearInterval(id);
  }, [pathname]);

  const email = authUser?.email ?? null;
  const allowed =
    isAdmin || isPrivilegedAdminEmail(email);

  if (!allowed) return null;

  const screenId = resolveScreenId(pathname, {
    step: step ?? 1,
  });

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
