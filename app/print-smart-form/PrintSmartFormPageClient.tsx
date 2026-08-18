"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import PrintWizardStep2, {
  type PrintWizardNavState,
} from "@/components/print-wizard/PrintWizardStep2";
import { useCredits } from "@/components/CreditsProvider";
import { isPrintSmartFormAdminEmail } from "@/lib/printSmartForm";

export default function PrintSmartFormPageClient() {
  const router = useRouter();
  const { authUser, socialProvidersLoaded } = useCredits();
  const allowed = isPrintSmartFormAdminEmail(authUser?.email);
  const [printNav, setPrintNav] = useState<PrintWizardNavState>({ step: 1 });

  useEffect(() => {
    if (!socialProvidersLoaded) return;
    if (!allowed) router.replace("/");
  }, [allowed, router, socialProvidersLoaded]);

  const handleNavChange = useCallback((nav: PrintWizardNavState) => {
    setPrintNav(nav);
  }, []);

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
      <Navbar
        printWizardBack={
          printNav.step === 2 && printNav.onBack
            ? { onClick: printNav.onBack }
            : undefined
        }
      />
      <div className="min-h-0 flex-1 overflow-hidden pt-12 md:pt-14 lg:pt-16">
        <PrintWizardStep2 onNavChange={handleNavChange} />
      </div>
    </main>
  );
}
