/**
 * Client helper — deposit sealed .sca into Space 4 / Template 04 (fire-and-forget safe).
 */

import type { StudioCanvasProjectV1 } from "@/lib/canvas/projectFile";
import { exportSecureProject } from "@/lib/projectStorage";

export type Space4VaultMeta = {
  id: string;
  userId: string;
  label: string;
  mode: "utility" | "agent";
  createdAt: number;
  source?: string;
  thumbSrc?: string | null;
};

export async function depositProjectToSpace4(opts: {
  project: StudioCanvasProjectV1;
  label?: string;
  source?: string;
}): Promise<{ id: string } | null> {
  try {
    const sealed = await exportSecureProject(opts.project);
    const wizard = opts.project.lookbook?.wizard;
    const thumbCandidates = [
      opts.project.studio.backgroundUrl,
      opts.project.studio.subjectUrl,
      wizard?.backgroundUrl,
      ...(wizard?.backgroundUrls ?? []),
    ].filter((u): u is string => typeof u === "string" && u.trim().length > 0);

    let thumbSrc: string | null = null;
    for (const thumb of thumbCandidates) {
      if (thumb.startsWith("http")) {
        thumbSrc = thumb.slice(0, 500);
        break;
      }
    }

    const res = await fetch("/api/space4/deposit", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        label:
          opts.label?.trim() ||
          (opts.project.studio.mode === "agent"
            ? "통합 에디터 프로젝트"
            : "템플릿 프로젝트"),
        mode: opts.project.studio.mode,
        sealedContent: sealed,
        createdAt: opts.project.savedAt || Date.now(),
        source: opts.source ?? "print-unified-editor",
        thumbSrc,
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { id?: string };
    return data.id ? { id: data.id } : null;
  } catch (err) {
    console.warn("[space4Client] deposit failed", err);
    return null;
  }
}

export async function fetchSpace4VaultMeta(
  limit = 500
): Promise<Space4VaultMeta[]> {
  try {
    const res = await fetch(`/api/admin/space4?limit=${limit}`, {
      credentials: "same-origin",
      cache: "no-store",
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { items?: Space4VaultMeta[] };
    return Array.isArray(data.items) ? data.items : [];
  } catch {
    return [];
  }
}

export async function promoteSpace4ToTemplate03(
  id: string
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  try {
    const res = await fetch("/api/admin/space4/promote", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      return { ok: false, error: data.error || "promote_failed" };
    }
    const data = (await res.json()) as { id?: string };
    return data.id ? { ok: true, id: data.id } : { ok: false, error: "no_id" };
  } catch {
    return { ok: false, error: "network" };
  }
}
