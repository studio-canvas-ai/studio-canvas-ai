import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import Footer from "@/components/Footer";
import HashScroll from "@/components/HashScroll";
import PaymentReturnBanner from "@/components/PaymentReturnBanner";
import { Suspense } from "react";

/**
 * Marketing landing only: intro + primary CTAs.
 * Style collection lives at /styles; personal works under /gallery/my.
 */
export default function Home() {
  return (
    <main className="relative w-full max-w-full overflow-x-hidden pb-[calc(3.75rem+env(safe-area-inset-bottom,0px))] md:pb-0">
      <HashScroll />
      <Navbar />
      <Suspense fallback={null}>
        <PaymentReturnBanner />
      </Suspense>
      <HeroSection />
      <Footer />
    </main>
  );
}
