import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import Footer from "@/components/Footer";
import HashScroll from "@/components/HashScroll";

/**
 * Marketing landing only: intro + primary CTAs.
 * Style collection lives at /styles; personal works under /gallery/my.
 */
export default function Home() {
  return (
    <main className="relative w-full max-w-full overflow-x-hidden">
      <HashScroll />
      <Navbar />
      <HeroSection />
      <Footer />
    </main>
  );
}
