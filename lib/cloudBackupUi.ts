/**
 * Shared in-flight counter for non-blocking cloud backup UX (gallery / Space 4).
 * Screen 26 (and other editors) subscribe to show a spinner while sync runs.
 */

export const CLOUD_BACKUP_STATUS_EVENT = "sca:cloud-backup-status";

export type CloudBackupStatusDetail = {
  busy: boolean;
  label: string;
  inflight: number;
};

let inflight = 0;
let label = "클라우드 백업 중...";

function emit() {
  if (typeof window === "undefined") return;
  const detail: CloudBackupStatusDetail = {
    busy: inflight > 0,
    label,
    inflight,
  };
  window.dispatchEvent(
    new CustomEvent(CLOUD_BACKUP_STATUS_EVENT, { detail })
  );
}

export function beginCloudBackup(
  nextLabel = "클라우드 백업 중..."
): void {
  inflight += 1;
  label = nextLabel;
  emit();
}

export function endCloudBackup(): void {
  inflight = Math.max(0, inflight - 1);
  if (inflight === 0) label = "클라우드 백업 중...";
  emit();
}

export function getCloudBackupStatus(): CloudBackupStatusDetail {
  return { busy: inflight > 0, label, inflight };
}
