import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import AdminPageClient from "./AdminPageClient";

export default function AdminPage() {
  return (
    <main className="relative min-h-screen overflow-hidden">
      <Navbar />
      <AdminPageClient />
      <Footer />
    </main>
  );
}
