import { notFound } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import PromotionAdminDashboard from "@/components/PromotionAdminDashboard";
import { getAdminSession } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

export default async function AdminPromotionsPage() {
  const session = await getAdminSession();
  if (!session) notFound();

  return (
    <main className="relative min-h-screen overflow-hidden">
      <Navbar />
      <section className="section-padding mx-auto max-w-6xl pt-28">
        <p className="text-xs font-medium tracking-widest text-glow-purple uppercase">
          Admin Only
        </p>
        <h1 className="font-display mt-2 text-3xl font-bold">프로모션 코드 관리</h1>
        <p className="mb-8 mt-2 text-sm text-white/50">
          선불 잔액형 코드를 일괄 발급하고 잔액 및 사용 이력을 확인합니다.
        </p>
        <PromotionAdminDashboard />
      </section>
      <Footer />
    </main>
  );
}
