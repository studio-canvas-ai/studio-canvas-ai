"use client";

import { useEffect } from "react";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { ensureSupabaseAuthStorageReady } from "@/lib/supabase/authStorage";

/**
 * Runs once on app load: purge foreign Supabase auth storage and, after a
 * project-ref change, clear any lingering session so Google OAuth cannot hang
 * on a stale PKCE/session from another project.
 */
export default function SupabaseAuthBootstrap() {
  useEffect(() => {
    if (!isSupabaseConfigured()) return;

    let cancelled = false;

    void (async () => {
      try {
        const { ref, projectChanged } = ensureSupabaseAuthStorageReady();
        if (!ref || !projectChanged || cancelled) return;

        const { createSupabaseBrowserClient } = await import(
          "@/lib/supabase/client"
        );
        const supabase = createSupabaseBrowserClient();
        await supabase.auth.signOut({ scope: "local" });
      } catch (err) {
        console.warn("[supabase] auth storage bootstrap:", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
