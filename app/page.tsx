import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import PersonaCreator from "@/components/PersonaCreator";
import StyleCollection from "@/components/StyleCollection";
import LivePreviewCanvas from "@/components/LivePreviewCanvas";
import PricingSection from "@/components/PricingSection";
import Footer from "@/components/Footer";
import HashScroll from "@/components/HashScroll";

export default function Home() {
  return (
    <main className="relative overflow-hidden">
      <HashScroll />
      <Navbar />
      <HeroSection />
      <PersonaCreator />
      <StyleCollection />
      <LivePreviewCanvas />
      <PricingSection />
      <Footer />
    </main>
  );
}
