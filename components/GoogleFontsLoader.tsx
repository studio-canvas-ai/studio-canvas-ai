"use client";

import { useEffect } from "react";

const FONT_HREF =
  "https://fonts.googleapis.com/css2?family=Black+Han+Sans&family=Do+Hyeon&family=Nanum+Pen+Script&family=Noto+Color+Emoji&family=Noto+Sans:wght@400;700&family=Noto+Sans+JP:wght@400;700&family=Noto+Sans+KR:wght@400;700&family=Noto+Sans+SC:wght@400;700&family=Orbitron:wght@600;700&display=swap";

/**
 * Load Google Fonts after mount so App Router stylesheet injection
 * is never blocked by layout <link>/<head> markup.
 */
export default function GoogleFontsLoader() {
  useEffect(() => {
    const ensure = (rel: string, href: string, crossOrigin?: string) => {
      if (document.querySelector(`link[href="${href}"]`)) return;
      const link = document.createElement("link");
      link.rel = rel;
      link.href = href;
      if (crossOrigin) link.crossOrigin = crossOrigin;
      document.head.appendChild(link);
    };
    ensure("preconnect", "https://fonts.googleapis.com");
    ensure("preconnect", "https://fonts.gstatic.com", "anonymous");
    ensure("stylesheet", FONT_HREF);
  }, []);

  return null;
}
