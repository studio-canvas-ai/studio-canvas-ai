import Navbar from "@/components/Navbar";
import LivePreviewCanvas from "@/components/LivePreviewCanvas";
import Footer from "@/components/Footer";

export default function GalleryPage() {
  return (
    <main className="relative min-h-screen overflow-hidden">
      <Navbar />
      <div className="pt-8">
        <LivePreviewCanvas />
      </div>
      <Footer />
    </main>
  );
}
