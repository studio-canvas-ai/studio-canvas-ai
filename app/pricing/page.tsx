import Navbar from "@/components/Navbar";
import PricingSection from "@/components/PricingSection";
import Footer from "@/components/Footer";
import PaymentReturnBanner from "@/components/PaymentReturnBanner";
import { Suspense } from "react";

export default function PricingPage() {
  return (
    <main className="relative overflow-x-hidden">
      <Navbar />
      <Suspense fallback={null}>
        <PaymentReturnBanner />
      </Suspense>
      <PricingSection layout="page" />
      <div className="[&_footer>div]:py-8 md:[&_footer>div]:py-10 lg:[&_footer>div]:py-10">
        <Footer />
      </div>
    </main>
  );
}
