import type { StudioCanvasProjectV1 } from "@/lib/canvas/projectFile";
import type { PhotoVaultItem } from "@/lib/photoVaultStorage";
import type { FaceProfile } from "@/lib/faceProfiles";

export type RecentProjectMeta = {
  id: string;
  savedAt: number;
  label: string;
  mode: "utility" | "agent";
  thumbSrc: string | null;
};

export const STUDIO_STORE_KINDS = [
  "recent_shared",
  "recent_photo",
  "upload_vault",
  "trained_vault",
] as const;

export type StudioStoreKind = (typeof STUDIO_STORE_KINDS)[number];

export type RecentDrawerEntry = {
  id: string;
  meta: RecentProjectMeta;
  project: StudioCanvasProjectV1;
};

export type StudioStoreBundle = {
  recentShared: RecentDrawerEntry[];
  recentPhoto: RecentDrawerEntry[];
  uploadVault: PhotoVaultItem[];
  trainedVault: PhotoVaultItem[];
  activeTrainedId: string | null;
};

export type StudioStoreRecoverDiagnostics = {
  aliasesTried: string[];
  manifestsFound: string[];
  supabaseRows: number;
  scaProjectsRecovered: number;
  faceProfilesRecovered: number;
  vaultsFromLookbooks: number;
  emptyR2Skipped: number;
};

export type StudioStoreRecoverResult = StudioStoreBundle & {
  ok: true;
  faceProfiles: FaceProfile[];
  diagnostics: StudioStoreRecoverDiagnostics;
};
