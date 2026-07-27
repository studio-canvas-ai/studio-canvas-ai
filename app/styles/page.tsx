import Navbar from "@/components/Navbar";
import StyleCollection from "@/components/StyleCollection";
import Footer from "@/components/Footer";

export default function StylesPage() {
  return (
    <main className="relative min-h-screen overflow-hidden">
      <Navbar />
      <div className="pt-8">
        <StyleCollection initialCategory="all" />
      </div>
      <Footer />
    </main>
  );
}
