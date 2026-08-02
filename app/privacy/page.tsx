import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import PrivacyPageClient from "./PrivacyPageClient";

export default function PrivacyPage() {
  return (
    <main className="relative min-h-screen overflow-hidden">
      <Navbar />
      <PrivacyPageClient />
      <Footer />
    </main>
  );
}
