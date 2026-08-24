import {
  studioBundleCounts,
  type StudioStoreCounts,
} from "@/lib/studioStore/persistKeys";
import type { StudioStoreBundle } from "@/lib/studioStore/types";

export type StudioStoreItemSummary = {
  id: string;
  label: string;
  savedAt: number;
};

export type StudioStoreSummary = {
  counts: StudioStoreCounts;
  recentShared: StudioStoreItemSummary[];
  recentPhoto: StudioStoreItemSummary[];
  uploadVault: StudioStoreItemSummary[];
  trainedVault: StudioStoreItemSummary[];
  activeTrainedId: string | null;
};

export function summarizeStudioBundle(
  bundle: StudioStoreBundle
): StudioStoreSummary {
  return {
    counts: studioBundleCounts(bundle),
    recentShared: bundle.recentShared.map((e) => ({
      id: e.id,
      label: e.meta.label || e.id,
      savedAt: e.meta.savedAt || 0,
    })),
    recentPhoto: bundle.recentPhoto.map((e) => ({
      id: e.id,
      label: e.meta.label || e.id,
      savedAt: e.meta.savedAt || 0,
    })),
    uploadVault: bundle.uploadVault.map((i) => ({
      id: i.id,
      label: i.label || i.id,
      savedAt: i.createdAt || 0,
    })),
    trainedVault: bundle.trainedVault.map((i) => ({
      id: i.id,
      label: i.label || i.id,
      savedAt: i.createdAt || 0,
    })),
    activeTrainedId: bundle.activeTrainedId,
  };
}
