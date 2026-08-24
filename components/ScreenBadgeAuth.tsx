"use client";

/**
 * Screen badge for /auth/* routes (no CreditsProvider).
 * Uses NextAuth session email against the privileged admin allow-list.
 */

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { isPrivilegedAdminEmail } from "@/lib/unlimitedAccount";
import {
  readInternalScreenStep,
  resolveScreenId,
} from "@/lib/screenRegistry";

export default function ScreenBadgeAuth() {
  const pathname = usePathname() || "/";
  const { data: session, status } = useSession();
  const [step, setStep] = useState<number | undefined>(undefined);

  useEffect(() => {
    const sync = () => setStep(readInternalScreenStep(pathname));
    sync();
    const id = window.setInterval(sync, 400);
    return () => window.clearInterval(id);
  }, [pathname]);

  if (status !== "authenticated") return null;

  const email =
    typeof session?.user?.email === "string" ? session.user.email : null;
  if (!isPrivilegedAdminEmail(email)) return null;

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
