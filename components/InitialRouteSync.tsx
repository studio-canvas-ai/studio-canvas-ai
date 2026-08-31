"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { APP_HOME_PATH, normalizeAppTabPath } from "@/lib/appRoutes";
import { saveAuthNextPath } from "@/lib/supabase/oauth";

/**
 * Keep post-auth "next" and bottom-tab home state aligned with SCREEN-001.
 */
export default function InitialRouteSync() {
  const pathname = normalizeAppTabPath(usePathname() || APP_HOME_PATH);

  useEffect(() => {
    if (pathname === APP_HOME_PATH) {
      saveAuthNextPath(APP_HOME_PATH);
    }
  }, [pathname]);

  return null;
}
