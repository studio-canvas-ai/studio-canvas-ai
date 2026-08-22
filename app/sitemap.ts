import type { MetadataRoute } from "next";
import { PRODUCTION_SITE_URL } from "@/lib/site";

const PUBLIC_PATHS = [
  "/",
  "/generate",
  "/shorts",
  "/shorts/studio",
  "/gallery",
  "/gallery/my",
  "/styles",
  "/template-studio",
  "/pricing",
  "/profile",
  "/support",
  "/terms",
  "/privacy",
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return PUBLIC_PATHS.map((path) => ({
    url: path === "/" ? PRODUCTION_SITE_URL : `${PRODUCTION_SITE_URL}${path}`,
    lastModified,
    changeFrequency: path === "/" || path === "/generate" ? "weekly" : "monthly",
    priority: path === "/" ? 1 : path === "/generate" || path === "/pricing" ? 0.9 : 0.7,
  }));
}
