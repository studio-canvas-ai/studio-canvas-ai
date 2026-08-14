"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import PrintWizardStep2 from "@/components/print-wizard/PrintWizardStep2";
import { useCredits } from "@/components/CreditsProvider";
import { isPrintSmartFormAdminEmail } from "@/lib/printSmartForm";

export default function PrintSmartFormPageClient() {
  const router = useRouter();
  const { authUser, socialProvidersLoaded } = useCredits();
  const allowed = isPrintSmartFormAdminEmail(authUser?.email);

  useEffect(() => {
    if (!socialProvidersLoaded) return;
    if (!allowed) router.replace("/");
  }, [allowed, router, socialProvidersLoaded]);

  if (!socialProvidersLoaded || !allowed) {
    return (
      <main className="print-wizard-shell relative min-h-screen overflow-hidden bg-[#0B0F19]">
        <Navbar />
        <div className="min-h-[50vh]" />
      </main>
    );
  }

  return (
    <main className="print-wizard-shell relative flex h-svh flex-col overflow-hidden bg-[#0B0F19]">
      <Navbar />
      {/* Navbar is position:fixed — reserve its height so content is not clipped */}
      <div className="min-h-0 flex-1 overflow-hidden pt-12 md:pt-14 lg:pt-16">
        <PrintWizardStep2 />
      </div>
    </main>
  );
}
