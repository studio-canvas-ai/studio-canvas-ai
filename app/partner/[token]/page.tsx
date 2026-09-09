import PartnerDashboardClient from "@/components/PartnerDashboardClient";

export const dynamic = "force-dynamic";

export default async function PartnerDashboardPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return (
    <main className="min-h-screen bg-[#070b14] text-white">
      <PartnerDashboardClient token={token} />
    </main>
  );
}
