"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import {
  recoverStudioStores,
  pushLocalStoresToServer,
} from "@/lib/studioStore/clientRecovery";

/**
 * On app load / login: cloud is the source of truth; localStorage/IndexedDB
 * are a cache. Empty local snapshots never overwrite Supabase/R2.
 */
export default function StudioStoreRecoveryBootstrap() {
  const { status } = useSession();
  const lastStatus = useRef<string | null>(null);

  useEffect(() => {
    const justLoggedIn =
      lastStatus.current !== "authenticated" && status === "authenticated";
    lastStatus.current = status;

    void (async () => {
      await recoverStudioStores({
        force: justLoggedIn || status === "authenticated",
      });
      if (status === "authenticated") {
        await pushLocalStoresToServer();
      }
    })();
  }, [status]);

  return null;
}
