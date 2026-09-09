import type { Metadata } from "next";
import ShareViewerClient from "@/components/share/ShareViewerClient";
import {
  buildShareViewerUrl,
  sanitizeShareId,
} from "@/lib/shareImageStore";
import {
  loadShareMetaById,
  resolveShareImageUrl,
} from "@/lib/shareImageStore.server";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id: rawId } = await params;
  const id = sanitizeShareId(rawId);
  const meta = id ? await loadShareMetaById(id) : null;
  const title = meta?.title || "Studio Canvas AI로 만든 인쇄물";
  const description =
    meta?.description ||
    "Studio Canvas AI에서 디자인한 인쇄물입니다. 버튼을 눌러 이미지를 바로 저장하세요.";
  let imageUrl: string | undefined;
  if (meta) {
    try {
      imageUrl = await resolveShareImageUrl(meta);
    } catch {
      imageUrl = undefined;
    }
  }

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      url: id ? buildShareViewerUrl(id) : undefined,
      images: imageUrl ? [{ url: imageUrl }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: imageUrl ? [imageUrl] : undefined,
    },
    robots: { index: false, follow: false },
  };
}

export default async function ShareViewerPage({ params }: PageProps) {
  const { id: rawId } = await params;
  const id = sanitizeShareId(rawId);

  if (!id) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-slate-950 px-6 text-center text-sm text-white/70">
        잘못된 공유 링크입니다.
      </div>
    );
  }

  return <ShareViewerClient shareId={id} />;
}
