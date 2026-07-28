import { ACCEPTED_IMAGE_EXT, ACCEPTED_IMAGE_MIME, MAX_UPLOAD_BYTES } from "@/lib/data";

export type ProcessedUpload = {
  url: string;
  name: string;
  convertedFromHeic?: boolean;
};

function getExt(file: File) {
  const fromName = file.name.split(".").pop()?.toLowerCase() ?? "";
  return fromName;
}

export function isAcceptedImageFile(file: File): boolean {
  const ext = getExt(file);
  const mime = (file.type || "").toLowerCase();
  if (ACCEPTED_IMAGE_EXT.includes(ext as (typeof ACCEPTED_IMAGE_EXT)[number])) return true;
  if (mime && ACCEPTED_IMAGE_MIME.includes(mime as (typeof ACCEPTED_IMAGE_MIME)[number])) {
    return true;
  }
  // Some iOS browsers leave HEIC type empty
  if (!mime && (ext === "heic" || ext === "heif")) return true;
  return false;
}

export function isHeicFile(file: File): boolean {
  const ext = getExt(file);
  const mime = (file.type || "").toLowerCase();
  return ext === "heic" || ext === "heif" || mime.includes("heic") || mime.includes("heif");
}

async function convertHeicToJpeg(file: File): Promise<Blob> {
  const heic2any = (await import("heic2any")).default;
  const result = await heic2any({
    blob: file,
    toType: "image/jpeg",
    quality: 0.92,
  });
  const blob = Array.isArray(result) ? result[0] : result;
  return blob as Blob;
}

export async function processUploadFiles(
  files: File[],
  remainingSlots: number
): Promise<{ ok: ProcessedUpload[]; errors: string[] }> {
  const slice = files.slice(0, Math.max(0, remainingSlots));
  const ok: ProcessedUpload[] = [];
  const errors: string[] = [];

  for (const file of slice) {
    if (!isAcceptedImageFile(file)) {
      errors.push(`unsupported:${file.name}`);
      continue;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      errors.push(`tooLarge:${file.name}`);
      continue;
    }

    try {
      if (isHeicFile(file)) {
        const jpeg = await convertHeicToJpeg(file);
        const url = URL.createObjectURL(jpeg);
        ok.push({
          url,
          name: file.name.replace(/\.(heic|heif)$/i, ".jpg"),
          convertedFromHeic: true,
        });
      } else {
        ok.push({ url: URL.createObjectURL(file), name: file.name });
      }
    } catch {
      errors.push(`convertFail:${file.name}`);
    }
  }

  return { ok, errors };
}
