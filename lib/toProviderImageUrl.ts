/**
 * Convert client-local blob:/object URLs into data URLs so the server
 * (and external AI providers) can fetch the image bytes.
 * Passes through http(s) and data: URLs unchanged.
 */
export async function toProviderImageUrl(url: string): Promise<string> {
  const trimmed = url.trim();
  if (!trimmed) throw new Error("empty_image_url");
  if (
    trimmed.startsWith("data:") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("http://")
  ) {
    return trimmed;
  }

  const res = await fetch(trimmed);
  if (!res.ok) {
    throw new Error(`image_fetch_failed:${res.status}`);
  }
  const blob = await res.blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string" && result.startsWith("data:")) {
        resolve(result);
      } else {
        reject(new Error("image_encode_failed"));
      }
    };
    reader.onerror = () => reject(new Error("image_encode_failed"));
    reader.readAsDataURL(blob);
  });
}

export async function toProviderImageUrls(urls: string[]): Promise<string[]> {
  return Promise.all(urls.map((u) => toProviderImageUrl(u)));
}
