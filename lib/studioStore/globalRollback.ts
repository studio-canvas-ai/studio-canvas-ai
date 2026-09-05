import { saveStudioStoreBundle } from "@/lib/studioStore/serverStore";
import { listLatestSnapshotsAtOrBefore } from "@/lib/studioStore/snapshots";

export type GlobalRollbackResult = {
  ok: true;
  targetTimestamp: string;
  restored: number;
  failed: number;
  failures: { appUserId: string; error: string }[];
};

export async function rollbackAllStudioStoresTo(
  target: Date
): Promise<GlobalRollbackResult> {
  const snapshots = await listLatestSnapshotsAtOrBefore(target.toISOString());
  let restored = 0;
  let failed = 0;
  const failures: { appUserId: string; error: string }[] = [];

  for (const snap of snapshots) {
    try {
      await saveStudioStoreBundle({
        canonicalUserId: snap.app_user_id,
        supabaseUserId: snap.user_id,
        bundle: snap.payload,
        mode: "replace",
        skipSnapshot: true,
      });
      restored += 1;
    } catch (err) {
      failed += 1;
      failures.push({
        appUserId: snap.app_user_id,
        error: err instanceof Error ? err.message : "restore_failed",
      });
    }
  }

  return {
    ok: true,
    targetTimestamp: target.toISOString(),
    restored,
    failed,
    failures: failures.slice(0, 20),
  };
}
