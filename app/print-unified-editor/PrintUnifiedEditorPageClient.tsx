"use client";

import Navbar from "@/components/Navbar";
import PrintUnifiedEditor from "@/components/print-unified-editor/PrintUnifiedEditor";

export default function PrintUnifiedEditorPageClient() {
  return (
    <main className="print-unified-editor-shell relative flex h-svh flex-col overflow-hidden bg-slate-100">
      <Navbar />
      <div className="min-h-0 flex-1 overflow-hidden bg-gradient-to-br from-slate-100 via-slate-50 to-white pt-12 md:pt-14 lg:pt-16">
        <PrintUnifiedEditor />
      </div>
    </main>
  );
}
