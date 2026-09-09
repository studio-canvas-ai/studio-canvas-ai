/**
 * Client helper — admin Template 03 warehouse operations.
 */

import type { Template03PublicRecord } from "@/lib/template03Public";

export async function fetchTemplate03Public(
  limit = 200
): Promise<Template03PublicRecord[]> {
  try {
    const res = await fetch(`/api/template-warehouse/public?limit=${limit}`, {
      credentials: "same-origin",
      cache: "no-store",
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { items?: Template03PublicRecord[] };
    return Array.isArray(data.items) ? data.items : [];
  } catch {
    return [];
  }
}

export async function deleteTemplate03Public(
  id: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const res = await fetch(`/api/admin/space3/${encodeURIComponent(id)}`, {
      method: "DELETE",
      credentials: "same-origin",
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      return { ok: false, error: data.error || "delete_failed" };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "network" };
  }
}
