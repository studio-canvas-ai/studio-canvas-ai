"use client";

import { useEffect } from "react";
import BridgeClient from "./BridgeClient";

/**
 * Fully client-only auth bridge.
 * - No server await / cookies / Supabase on the server
 * - Escape timers run in the browser only (useEffect + inline script in HTML)
 * - BridgeClient is statically imported so session work starts without an
 *   extra dynamic() chunk fetch (Supabase client remains lazily imported)
 */
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
    }, 12000);
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
    }, 12000);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: ESCAPE_JS }} />
      <BridgeClient />
    </>
  );
}
