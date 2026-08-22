import Navbar from "@/components/Navbar";
import StyleCollection from "@/components/StyleCollection";
import Footer from "@/components/Footer";

export default function StylesPage() {
  return (
    <main className="relative min-h-screen overflow-hidden">
      <Navbar />
      <StyleCollection initialCategory="all" layout="page" />
      <Footer />
    </main>
  );
}
