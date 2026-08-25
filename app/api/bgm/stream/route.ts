import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 25 * 1024 * 1024;
const ALLOWED_HOSTS = new Set([
  "pub-bb48348c54c946a7b4a57af9900c473b.r2.dev",
]);

function isBlockedHost(hostname: string) {
  const host = hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost")) return true;
  if (host === "127.0.0.1" || host === "0.0.0.0" || host === "::1") return true;
  if (host.startsWith("10.") || host.startsWith("192.168.") || host.startsWith("169.254.")) {
    return true;
  }
  return false;
}

/** Same-origin audio proxy for FFmpeg.wasm BGM fetch (R2 CORS-safe). */
export async function GET(req: Request) {
  const src = new URL(req.url).searchParams.get("src")?.trim() ?? "";
  if (!src) {
    return NextResponse.json({ error: "src_required" }, { status: 400 });
  }

  let target: URL;
  try {
    target = new URL(src);
  } catch {
    return NextResponse.json({ error: "invalid_url" }, { status: 400 });
  }

  if (target.protocol !== "https:") {
    return NextResponse.json({ error: "unsupported_protocol" }, { status: 400 });
  }
  if (isBlockedHost(target.hostname) || !ALLOWED_HOSTS.has(target.hostname.toLowerCase())) {
    return NextResponse.json({ error: "blocked_host" }, { status: 403 });
  }
  if (!target.pathname.toLowerCase().includes("/bgm/")) {
    return NextResponse.json({ error: "not_bgm_path" }, { status: 403 });
  }

  try {
    const upstream = await fetch(target.toString(), {
      cache: "force-cache",
      headers: { Accept: "audio/mpeg,audio/*,*/*;q=0.8" },
    });
    if (!upstream.ok) {
      return NextResponse.json(
        { error: "fetch_failed", status: upstream.status },
        { status: 502 }
      );
    }

    const contentType = upstream.headers.get("content-type") ?? "audio/mpeg";
    const buffer = Buffer.from(await upstream.arrayBuffer());
    if (buffer.length < 256 || buffer.length > MAX_BYTES) {
      return NextResponse.json({ error: "invalid_size" }, { status: 413 });
    }

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType.startsWith("audio/")
          ? contentType
          : "audio/mpeg",
        "Cache-Control": "public, max-age=86400, immutable",
      },
    });
  } catch (err) {
    console.error("[api/bgm/stream]", err);
    return NextResponse.json({ error: "proxy_failed" }, { status: 502 });
  }
}
