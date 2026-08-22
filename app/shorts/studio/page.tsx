import ShortsTextEditStudio from "@/components/ShortsTextEditStudio";

/**
 * /shorts/studio — full-page hybrid dual studio (legacy single editor: ?legacy=1).
 * Expects session from ShortsHookFrameGrid → saveShortsStudioSession.
 * No site Navbar/Footer — the studio owns the entire viewport.
 */
export default function ShortsStudioPage() {
  return (
    <main className="relative h-[100dvh] w-screen overflow-hidden bg-[#0b0d14]">
      <ShortsTextEditStudio />
    </main>
  );
}
