import Navbar from "@/components/Navbar";
import PricingSection from "@/components/PricingSection";
import Footer from "@/components/Footer";
import PaymentReturnBanner from "@/components/PaymentReturnBanner";
import { Suspense } from "react";

export default function PricingPage() {
  return (
    <main className="relative min-h-screen overflow-hidden">
      <Navbar />
      <div className="pt-8">
        <Suspense fallback={null}>
          <PaymentReturnBanner />
        </Suspense>
        <PricingSection />
      </div>
      <Footer />
    </main>
  );
}
