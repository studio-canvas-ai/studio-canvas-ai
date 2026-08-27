/**
 * Client helper — deposit sealed .sca into Space 4 (fire-and-forget safe).
 */

import type { StudioCanvasProjectV1 } from "@/lib/canvas/projectFile";
import { exportSecureProject } from "@/lib/projectStorage";

export async function depositProjectToSpace4(opts: {
  project: StudioCanvasProjectV1;
  label?: string;
  source?: string;
}): Promise<{ id: string } | null> {
  try {
    const sealed = await exportSecureProject(opts.project);
    const thumb =
      opts.project.studio.backgroundUrl || opts.project.studio.subjectUrl;
    const thumbSrc =
      thumb && !thumb.startsWith("data:") ? thumb.slice(0, 500) : null;

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
