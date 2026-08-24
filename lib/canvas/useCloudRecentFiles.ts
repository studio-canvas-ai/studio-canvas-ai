"use client";

/**
 * Shared hook for SCREEN-007 / 008 / 010 recent SCA files.
 * UI can keep using listRecentProjects; this is the cloud-facing surface.
 */

import { useCallback, useEffect, useState } from "react";
import { loadCloudRecentFiles } from "@/lib/canvas/cloudRecentFiles";
import type { RecentProjectNamespace } from "@/lib/canvas/recentProjects";
import type { RecentProjectMeta } from "@/lib/studioStore/types";
import type { StudioCanvasProjectV1 } from "@/lib/canvas/projectFile";

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
