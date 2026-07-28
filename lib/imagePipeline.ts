import sharp from "sharp";

export const THUMB_MAX_WIDTH = 600;
export const THUMB_WEBP_QUALITY = 75;

/** Gallery list: lightweight WebP (~50KB target). */
export async function createGalleryThumbnail(input: Buffer): Promise<Buffer> {
  return sharp(input)
    .rotate()
    .resize({
      width: THUMB_MAX_WIDTH,
      withoutEnlargement: true,
      fit: "inside",
    })
    .webp({ quality: THUMB_WEBP_QUALITY })
    .toBuffer();
}

/** Original kept for on-demand HD download (FHD/4K source). */
export async function normalizeOriginal(input: Buffer): Promise<{ buffer: Buffer; contentType: string }> {
  const meta = await sharp(input).metadata();
  const format = meta.format;
  if (format === "jpeg") {
    return { buffer: input, contentType: "image/jpeg" };
  }
  if (format === "png") {
    return { buffer: input, contentType: "image/png" };
  }
  const buffer = await sharp(input).rotate().jpeg({ quality: 92 }).toBuffer();
  return { buffer, contentType: "image/jpeg" };
}
