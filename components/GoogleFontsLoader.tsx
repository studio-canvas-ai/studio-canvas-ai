"use client";

import { useEffect } from "react";

/**
 * Multilingual Shorts / Thumbnail display fonts.
 * Family CSS names must match FONT_PRESET_PRIMARY / FONT_STACK in thumbnailStyles.
 */
const FONT_HREF =
  "https://fonts.googleapis.com/css2?" +
  [
    "family=Anton",
    "family=Black+Han+Sans",
    "family=Do+Hyeon",
    "family=East+Sea+Dokdo",
    "family=Gaegu:wght@300;400;700",
    "family=Gothic+A1:wght@100;200;300;400;500;600;700;800;900",
    "family=Jua",
    "family=Limelight",
    "family=Nanum+Brush+Script",
    "family=Nanum+Pen+Script",
    "family=Noto+Sans:wght@300;400;500;600;700;800;900",
    "family=Noto+Sans+Devanagari:wght@300;400;500;600;700;800;900",
    "family=Noto+Sans+JP:wght@300;400;500;600;700;800;900",
    "family=Noto+Sans+KR:wght@300;400;500;600;700;800;900",
    "family=Noto+Sans+SC:wght@300;400;500;600;700;800;900",
    "family=Noto+Sans+TC:wght@300;400;500;600;700;800;900",
    "family=Noto+Serif:wght@300;400;500;600;700;800;900",
    "family=Noto+Serif+JP:wght@300;400;500;600;700;800;900",
    "family=Noto+Serif+KR:wght@300;400;500;600;700;800;900",
    "family=Noto+Serif+SC:wght@300;400;500;600;700;800;900",
    "family=Nunito:wght@300;400;500;600;700;800;900",
    "family=Orbitron:wght@400;500;600;700;800;900",
    "family=Song+Myung",
    "display=swap",
  ].join("&");

/** Pretendard (CDN) — modern KR gothic used as default AI caption face. */
const PRETENDARD_HREF =
  "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css";

/**
 * Commercial-free KR display faces (noonnu / brand fonts) not on Google Fonts.
 * CSS family names must match FONT_PRESET_PRIMARY.
 */
const KR_DISPLAY_FACE_CSS = `
@font-face {
  font-family: "Gmarket Sans";
  font-weight: 300;
  font-display: swap;
  src: url("https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_2001@1.1/GmarketSansLight.woff") format("woff");
}
@font-face {
  font-family: "Gmarket Sans";
  font-weight: 500;
  font-display: swap;
  src: url("https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_2001@1.1/GmarketSansMedium.woff") format("woff");
}
@font-face {
  font-family: "Gmarket Sans";
  font-weight: 700;
  font-display: swap;
  src: url("https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_2001@1.1/GmarketSansBold.woff") format("woff");
}
@font-face {
  font-family: "GmarketSans";
  font-weight: 300;
  font-display: swap;
  src: url("https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_2001@1.1/GmarketSansLight.woff") format("woff");
}
@font-face {
  font-family: "GmarketSans";
  font-weight: 500;
  font-display: swap;
  src: url("https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_2001@1.1/GmarketSansMedium.woff") format("woff");
}
@font-face {
  font-family: "GmarketSans";
  font-weight: 700;
  font-display: swap;
  src: url("https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_2001@1.1/GmarketSansBold.woff") format("woff");
}
@font-face {
  font-family: "Juache";
  font-weight: 400;
  font-display: swap;
  src: url("https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_one@1.0/BMJUA.woff") format("woff");
}
@font-face {
  font-family: "YeogiOttaeJalnan";
  font-weight: 400;
  font-display: swap;
  src: url("https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_four@1.2/JalnanOTF00.woff") format("woff");
}
@font-face {
  font-family: "NexonMaplestory";
  font-weight: 300;
  font-display: swap;
  src: url("https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_20-04@2.1/MaplestoryOTFLight.woff") format("woff");
}
@font-face {
  font-family: "NexonMaplestory";
  font-weight: 700;
  font-display: swap;
  src: url("https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_20-04@2.1/MaplestoryOTFBold.woff") format("woff");
}
@font-face {
  font-family: "TmonMonsori";
  font-weight: 400;
  font-display: swap;
  src: url("https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_two@1.0/TmonMonsori.woff") format("woff");
}
@font-face {
  font-family: "Tmon";
  font-weight: 400;
  font-display: swap;
  src: url("https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_two@1.0/TmonMonsori.woff") format("woff");
}
`;

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
    ensure("preconnect", "https://cdn.jsdelivr.net", "anonymous");
    ensure("stylesheet", FONT_HREF);
    ensure("stylesheet", PRETENDARD_HREF);

    if (!document.getElementById("studio-kr-display-faces")) {
      const style = document.createElement("style");
      style.id = "studio-kr-display-faces";
      style.textContent = KR_DISPLAY_FACE_CSS;
      document.head.appendChild(style);
    }
  }, []);

  return null;
}
