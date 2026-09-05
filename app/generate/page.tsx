import { redirect } from "next/navigation";
import Navbar from "@/components/Navbar";
import PersonaCreator from "@/components/PersonaCreator";
import Footer from "@/components/Footer";
import { SHORTS_THUMBNAIL_PATH } from "@/lib/shortsThumbnail";

/**
 * /generate — AI portrait / thumbnail create + edit workspace.
 * App Router entry: app/generate/page.tsx
 *
 * Alias: `/generate?mode=video` → Shorts / video-thumbnail workspace (`/shorts`).
 */
export default async function GeneratePage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string | string[] }>;
}) {
  const params = await searchParams;
  const mode = Array.isArray(params.mode) ? params.mode[0] : params.mode;
  if (mode === "video") {
    redirect(SHORTS_THUMBNAIL_PATH);
  }

  return (
    <main className="relative min-h-screen overflow-x-hidden">
      <Navbar />
      <div className="pt-4 md:pt-8">
        <PersonaCreator />
      </div>
      <Footer />
    </main>
  );
}
