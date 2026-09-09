import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import AdminPartnersClient from "@/components/AdminPartnersClient";

export const dynamic = "force-dynamic";

export default function AdminPartnersPage() {
  return (
    <main className="relative min-h-screen overflow-hidden">
      <Navbar />
      <section className="section-padding mx-auto max-w-5xl pt-28">
        <p className="text-xs font-medium tracking-widest text-glow-purple uppercase">
          Admin Only
        </p>
        <h1 className="font-display mt-2 text-3xl font-bold">파트너 슬롯 관리</h1>
        <p className="mb-8 mt-2 text-sm text-white/50">
          유튜버 파트너 10슬롯 · 레퍼럴 링크 · 가입/유료전환 · 10% 정산 현황을
          관리합니다. 슬롯은 비어 있는 상태로 시작하며 이메일·채널 정보를 나중에
          매핑하면 됩니다.
        </p>
        <AdminPartnersClient />
      </section>
      <Footer />
    </main>
  );
}
