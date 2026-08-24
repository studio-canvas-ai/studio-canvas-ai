/**
 * Cloud SCA recent-files (user_saved_forms).
 * Drop-in for localStorage drawers: load/save per SCREEN-007 / 008 / 010.
 * Uses the NextAuth session so Naver / Kakao / Google / email all share one account.
 */

import { useCallback, useEffect, useState } from "react";
import type { StudioCanvasProjectV1 } from "@/lib/canvas/projectFile";
import { parseStudioProject } from "@/lib/canvas/projectFile";
import type { RecentProjectNamespace } from "@/lib/canvas/recentProjects";
import type { RecentDrawerEntry, RecentProjectMeta } from "@/lib/studioStore/types";

export type CloudRecentFilesResult = {
  ok: boolean;
  authenticated: boolean;
  entries: RecentDrawerEntry[];
};

function parseEntries(raw: unknown): RecentDrawerEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: RecentDrawerEntry[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    if (typeof r.id !== "string" || !r.meta || !r.project) continue;
    try {
      out.push({
        id: r.id,
        meta: r.meta as RecentProjectMeta,
        project: parseStudioProject(r.project),
      });
    } catch {
      /* skip */
    }
  }
  return out;
}

async function withBrowserSupabase() {
  const { isSupabaseConfigured } = await import("@/lib/supabase/config");
  if (!isSupabaseConfigured()) return null;
  const { createSupabaseBrowserClient } = await import("@/lib/supabase/client");
  const supabase = createSupabaseBrowserClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user?.id) return null;
  return { supabase, userId: data.user.id };
}

/** Load this screen's SCA recent drawer from the signed-in account. */
export async function loadCloudRecentFiles(
  namespace: RecentProjectNamespace
): Promise<CloudRecentFilesResult> {
  if (typeof window === "undefined") {
    return { ok: false, authenticated: false, entries: [] };
  }
  try {
    const res = await fetch(
      `/api/recent-files?namespace=${encodeURIComponent(namespace)}`,
      { method: "GET", credentials: "same-origin", cache: "no-store" }
    );
    if (res.status === 401) {
      const browser = await withBrowserSupabase();
      if (!browser) return { ok: false, authenticated: false, entries: [] };
      const { data, error } = await browser.supabase
        .from("user_saved_forms")
        .select("payload")
        .eq("screen_id", namespace)
        .eq("user_id", browser.userId)
        .maybeSingle();
      if (error) {
        return { ok: false, authenticated: true, entries: [] };
      }
      return {
        ok: true,
        authenticated: true,
        entries: parseEntries(
          (data as { payload?: unknown } | null)?.payload
        ),
      };
    }
    if (!res.ok) {
      return { ok: false, authenticated: true, entries: [] };
    }
    const body = (await res.json()) as { ok?: boolean; entries?: unknown };
    return {
      ok: body.ok !== false,
      authenticated: true,
      entries: parseEntries(body.entries),
    };
  } catch (err) {
    console.warn("[cloudRecentFiles] load failed", err);
    return { ok: false, authenticated: false, entries: [] };
  }
}

/** Persist this screen's SCA recent drawer to the signed-in account. */
export async function saveCloudRecentFiles(
  namespace: RecentProjectNamespace,
  entries: RecentDrawerEntry[]
): Promise<boolean> {
  if (typeof window === "undefined") return false;
  try {
    const res = await fetch("/api/recent-files", {
      method: "PUT",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ namespace, entries }),
    });
    if (res.ok) return true;
    if (res.status !== 401) return false;
    const browser = await withBrowserSupabase();
    if (!browser) return false;
    const row = {
      user_id: browser.userId,
      app_user_id: browser.userId,
      screen_id: namespace,
      payload: entries,
      updated_at: new Date().toISOString(),
    };
    const { error } = await browser.supabase.from("user_saved_forms").upsert(row, {
      onConflict: "user_id,screen_id",
    });
    if (error) {
      console.warn("[cloudRecentFiles] supabase upsert skipped:", error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn("[cloudRecentFiles] save failed", err);
    return false;
  }
}

/**
 * Shared hook for SCREEN-007 / 008 / 010 recent SCA files.
 * UI can keep using listRecentProjects; this is the cloud-facing surface.
 */
export function useCloudRecentFiles(namespace: RecentProjectNamespace) {
  const [items, setItems] = useState<RecentProjectMeta[]>([]);
  const [loading, setLoading] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const { listRecentProjects } = await import("@/lib/canvas/recentProjects");
      const next = await listRecentProjects(namespace);
      setItems(next);
      const cloud = await loadCloudRecentFiles(namespace);
      setAuthenticated(cloud.authenticated);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [namespace]);

  const save = useCallback(
    async (project: StudioCanvasProjectV1) => {
      const { pushRecentProject } = await import("@/lib/canvas/recentProjects");
      const meta = await pushRecentProject(project, namespace);
      await refresh();
      return meta;
    },
    [namespace, refresh]
  );

  const load = useCallback(
    async (id: string) => {
      const { getRecentProject } = await import("@/lib/canvas/recentProjects");
      return getRecentProject(id, namespace);
    },
    [namespace]
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { items, loading, authenticated, refresh, save, load };
}
