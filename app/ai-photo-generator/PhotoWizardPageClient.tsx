"use client";

import { useCallback, useState } from "react";
import Navbar from "@/components/Navbar";
import PrintWizardStep2, {
  type PrintWizardNavState,
} from "@/components/print-wizard/PrintWizardStep2";

export default function PhotoWizardPageClient() {
  const [printNav, setPrintNav] = useState<PrintWizardNavState>({ step: 1 });

  const handleNavChange = useCallback((nav: PrintWizardNavState) => {
    setPrintNav(nav);
  }, []);

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
        <PrintWizardStep2 productId="photo" onNavChange={handleNavChange} />
      </div>
    </main>
  );
}
