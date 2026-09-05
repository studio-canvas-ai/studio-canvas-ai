import { loadMergedCloudBundle, saveStudioStoreBundle } from "@/lib/studioStore/serverStore";
import {
  getStudioStoreSnapshot,
  insertStudioStoreSnapshot,
  listStudioStoreSnapshots,
  type StudioStoreSnapshotMeta,
} from "@/lib/studioStore/snapshots";
import {
  studioBundleCounts,
  studioBundleIsEmpty,
  type StudioStoreCounts,
} from "@/lib/studioStore/persistKeys";
import { summarizeStudioBundle, type StudioStoreSummary } from "@/lib/studioStore/summarize";
import type { StudioStoreBundle } from "@/lib/studioStore/types";

function countsNonEmpty(c: StudioStoreCounts): boolean {
  return (
    c.recentShared > 0 ||
    c.recentPhoto > 0 ||
    c.uploadVault > 0 ||
    c.trainedVault > 0
  );
}

export type StudioStoreInspectResult = {
  current: StudioStoreSummary;
  snapshots: StudioStoreSnapshotMeta[];
  supabaseRows: number;
  r2Keys: string[];
  hasRestorableBackup: boolean;
};

export async function inspectStudioStoreForAliases(
  aliases: string[]
): Promise<StudioStoreInspectResult> {
  const cloud = await loadMergedCloudBundle(aliases);
  const snapshots = await listStudioStoreSnapshots(aliases);
  const current = summarizeStudioBundle(cloud.bundle);
  const hasSnap = snapshots.some((s) => countsNonEmpty(s.counts));
  return {
    current,
    snapshots,
    supabaseRows: cloud.supabaseRows,
    r2Keys: cloud.r2Keys,
    hasRestorableBackup: hasSnap || !studioBundleIsEmpty(cloud.bundle),
  };
}

export async function restoreStudioStoreForUser(opts: {
  canonicalUserId: string;
  supabaseUserId?: string | null;
  aliases: string[];
  snapshotId?: string | null;
}): Promise<
  | {
      ok: true;
      source: "snapshot" | "current_cloud";
      snapshotId: string | null;
      current: StudioStoreSummary;
    }
  | { ok: false; error: string }
> {
  const aliases = [...new Set([opts.canonicalUserId, ...opts.aliases])].filter(
    Boolean
  );
  const cloud = await loadMergedCloudBundle(aliases);
  const snaps = await listStudioStoreSnapshots(aliases);

  let bundle: StudioStoreBundle | null = null;
  let source: "snapshot" | "current_cloud" = "current_cloud";
  let snapshotId: string | null = null;

  if (opts.snapshotId) {
    const snap = await getStudioStoreSnapshot(opts.snapshotId);
    if (!snap || studioBundleIsEmpty(snap.payload)) {
      return { ok: false, error: "snapshot_empty" };
    }
    bundle = snap.payload;
    source = "snapshot";
    snapshotId = snap.id;
  } else {
    const latest =
      snaps.find((s) => countsNonEmpty(s.counts) && s.reason !== "pre_restore") ||
      snaps.find((s) => countsNonEmpty(s.counts));
    if (latest) {
      const snap = await getStudioStoreSnapshot(latest.id);
      if (snap && !studioBundleIsEmpty(snap.payload)) {
        bundle = snap.payload;
        source = "snapshot";
        snapshotId = snap.id;
      }
    }
    if (!bundle && !studioBundleIsEmpty(cloud.bundle)) {
      bundle = cloud.bundle;
      source = "current_cloud";
    }
  }

  if (!bundle || studioBundleIsEmpty(bundle)) {
    return { ok: false, error: "no_backup" };
  }

  if (!studioBundleIsEmpty(cloud.bundle)) {
    await insertStudioStoreSnapshot({
      canonicalUserId: opts.canonicalUserId,
      supabaseUserId: opts.supabaseUserId,
      bundle: cloud.bundle,
      reason: "pre_restore",
    });
  }

  const durable = await saveStudioStoreBundle({
    canonicalUserId: opts.canonicalUserId,
    supabaseUserId: opts.supabaseUserId,
    bundle,
    mode: "replace",
    snapshotReason: "admin_restore",
  });

  return {
    ok: true,
    source,
    snapshotId,
    current: summarizeStudioBundle(durable),
  };
}

export { studioBundleCounts };
