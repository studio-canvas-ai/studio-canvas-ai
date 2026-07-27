import Navbar from "@/components/Navbar";
import PersonaCreator from "@/components/PersonaCreator";
import Footer from "@/components/Footer";

export default function GeneratePage() {
  return (
    <main className="relative min-h-screen overflow-hidden">
      <Navbar />
      <div className="pt-8">
        <PersonaCreator />
      </div>
      <Footer />
    </main>
  );
}
