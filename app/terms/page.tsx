import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import TermsPageClient from "./TermsPageClient";

export default function TermsPage() {
  return (
    <main className="relative min-h-screen overflow-hidden">
      <Navbar />
      <TermsPageClient />
      <Footer />
    </main>
  );
}
