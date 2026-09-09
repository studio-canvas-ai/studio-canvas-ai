import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import MyGalleryPageClient from "./MyGalleryPageClient";

export default function MyGalleryPage() {
  return (
    <main className="relative min-h-screen w-full overflow-x-hidden">
      <Navbar />
      <MyGalleryPageClient />
      <Footer />
    </main>
  );
}
