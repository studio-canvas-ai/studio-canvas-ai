"use client";

import dynamic from "next/dynamic";
import { useEffect } from "react";

/**
 * Fully client-only auth bridge.
 * - No server await / cookies / Supabase on the server
 * - BridgeClient is ssr:false so it never runs during SSR
 * - Escape timers run in the browser only (useEffect + inline script in HTML)
 */
const BridgeClient = dynamic(() => import("./BridgeClient"), {
  ssr: false,
  loading: () => (
    <p className="text-sm text-white/70" id="sca-bridge-status">
      Signing you in…
    </p>
  ),
});

const ESCAPE_JS = `
(function(){
  try {
    if (window.__scaBridgeEscaped) return;
    window.setTimeout(function(){
      try {
        if (window.__scaBridgeDone || window.__scaBridgeEscaped) return;
        window.__scaBridgeEscaped = true;
        location.replace("/generate?authError=" + encodeURIComponent("bridge_inline_timeout"));
      } catch (e) {}
    }, 8000);
  } catch (e) {}
})();
`;

export default function AuthBridgePage() {
  // Backup escape if the inline script was stripped; still browser-only.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const w = window as Window & {
        __scaBridgeDone?: boolean;
        __scaBridgeEscaped?: boolean;
      };
      if (w.__scaBridgeDone || w.__scaBridgeEscaped) return;
      w.__scaBridgeEscaped = true;
      window.location.replace(
        `/generate?authError=${encodeURIComponent("bridge_client_timeout")}`
      );
    }, 8000);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 px-6 text-center">
      <script dangerouslySetInnerHTML={{ __html: ESCAPE_JS }} />
      <BridgeClient />
    </div>
  );
}
