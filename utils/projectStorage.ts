/**
 * Re-export path requested as utils/projectStorage — implementation lives in lib/.
 */
export {
  SCA_FILE_EXT,
  SCA_MAGIC,
  SCA_FORMAT_VERSION,
  exportSecureProject,
  exportSecureProjectBlob,
  importSecureProject,
  projectStorageErrorMessage,
} from "@/lib/projectStorage";
