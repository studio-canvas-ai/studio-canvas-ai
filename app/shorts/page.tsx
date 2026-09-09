import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ShortsThumbnailWorkspace from "@/components/ShortsThumbnailWorkspace";

/**
 * /shorts — 영상/썸네일 (Shorts thumbnail) workspace entry.
 *
 * Phase 1: routing + shell.
 * Phase 2: video pick/upload → Cloudflare R2 (presigned PUT).
 * Phase 3: AI hook-frame extract → thumbs/shorts/… on R2.
 * Later: text edit studio.
 *
 * Alias intent: `/generate?mode=video` may redirect here in a later pass;
 * mobile bottom tab + desktop hero CTA both target SHORTS_THUMBNAIL_PATH.
 */
export default function ShortsPage() {
  return (
    <main className="relative min-h-screen overflow-x-hidden">
      <Navbar />
      <div className="pt-4 md:pt-8">
        <ShortsThumbnailWorkspace />
      </div>
      <Footer />
    </main>
  );
}
