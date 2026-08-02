import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SupportPageClient from "./SupportPageClient";

export default function SupportPage() {
  return (
    <main className="relative min-h-screen overflow-hidden">
      <Navbar />
      <SupportPageClient />
      <Footer />
    </main>
  );
}
