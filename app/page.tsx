import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import StyleCollection from "@/components/StyleCollection";
import Footer from "@/components/Footer";
import HashScroll from "@/components/HashScroll";

/**
 * Marketing landing only: intro + CTA + official style showroom.
 * Personal works live exclusively under /gallery/my; creation under /generate.
 */
export default function Home() {
  return (
    <main className="relative w-full max-w-full overflow-x-hidden">
      <HashScroll />
      <Navbar />
      <HeroSection />
      <StyleCollection />
      <Footer />
    </main>
  );
}
