"use client";

import Navbar from "@/components/Navbar";
import PrintUnifiedEditor from "@/components/print-unified-editor/PrintUnifiedEditor";

export default function PrintUnifiedEditorPageClient() {
  return (
    <main className="print-unified-editor-shell relative flex h-svh flex-col overflow-hidden bg-slate-950">
      <Navbar />
      <div className="min-h-0 flex-1 overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 pt-12 md:pt-14 lg:pt-16">
        <PrintUnifiedEditor />
      </div>
    </main>
  );
}
