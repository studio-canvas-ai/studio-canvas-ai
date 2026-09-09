"use client";

import { useEffect, useState } from "react";
import {
  CLOUD_BACKUP_STATUS_EVENT,
  getCloudBackupStatus,
  type CloudBackupStatusDetail,
} from "@/lib/cloudBackupUi";

/** Subscribe to background gallery / Template 4 sync status. */
export function useCloudBackupStatus(): CloudBackupStatusDetail {
  const [status, setStatus] = useState<CloudBackupStatusDetail>(() =>
    getCloudBackupStatus()
  );

  useEffect(() => {
    const onStatus = (event: Event) => {
      const detail = (event as CustomEvent<CloudBackupStatusDetail>).detail;
      if (detail) setStatus(detail);
      else setStatus(getCloudBackupStatus());
    };
    setStatus(getCloudBackupStatus());
    window.addEventListener(CLOUD_BACKUP_STATUS_EVENT, onStatus);
    return () => window.removeEventListener(CLOUD_BACKUP_STATUS_EVENT, onStatus);
  }, []);

  return status;
}
