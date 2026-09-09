import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_BYTES = 20 * 1024 * 1024;

function isBlockedHost(hostname: string) {
  const host = hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost")) return true;
  if (host === "127.0.0.1" || host === "0.0.0.0" || host === "::1") return true;
  if (host.startsWith("10.") || host.startsWith("192.168.") || host.startsWith("169.254.")) {
    return true;
  }
  return false;
}

/** Same-origin image proxy so canvas editors can draw R2/CDN photos without CORS taint. */
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

  if (target.protocol !== "https:" && target.protocol !== "http:") {
    return NextResponse.json({ error: "unsupported_protocol" }, { status: 400 });
  }
  if (isBlockedHost(target.hostname)) {
    return NextResponse.json({ error: "blocked_host" }, { status: 400 });
  }

  try {
    const upstream = await fetch(target.toString(), {
      cache: "no-store",
      headers: { Accept: "image/*,*/*;q=0.8" },
    });
    if (!upstream.ok) {
      return NextResponse.json(
        { error: "fetch_failed", status: upstream.status },
        { status: 502 }
      );
    }

    const contentType = upstream.headers.get("content-type") ?? "application/octet-stream";
    if (!contentType.startsWith("image/") && contentType !== "application/octet-stream") {
      return NextResponse.json({ error: "not_image" }, { status: 415 });
    }

    const buffer = Buffer.from(await upstream.arrayBuffer());
    if (buffer.length < 32 || buffer.length > MAX_BYTES) {
      return NextResponse.json({ error: "invalid_size" }, { status: 413 });
    }

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType.startsWith("image/")
          ? contentType
          : "image/png",
        // Short private cache — rembg cutouts should refresh when URL changes.
        "Cache-Control": "private, max-age=60, must-revalidate",
      },
    });
  } catch (err) {
    console.error("[media/fetch]", err);
    return NextResponse.json({ error: "proxy_failed" }, { status: 502 });
  }
}
