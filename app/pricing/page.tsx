import Navbar from "@/components/Navbar";
import PricingSection from "@/components/PricingSection";
import Footer from "@/components/Footer";

export default function PricingPage() {
  return (
    <main className="relative min-h-screen overflow-hidden">
      <Navbar />
      <div className="pt-8">
        <PricingSection />
      </div>
      <Footer />
    </main>
  );
}
