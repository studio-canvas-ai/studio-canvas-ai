import type { MetadataRoute } from "next";
import { PRODUCTION_SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/api/", "/print-smart-form", "/print-smart-form/"],
    },
    sitemap: `${PRODUCTION_SITE_URL}/sitemap.xml`,
    host: PRODUCTION_SITE_URL,
  };
}
