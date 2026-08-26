import PrintUnifiedEditorPageClient from "./PrintUnifiedEditorPageClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "원페이지 통합 에디터 | Studio Canvas AI",
  robots: { index: false, follow: false },
};

export default function PrintUnifiedEditorPage() {
  return <PrintUnifiedEditorPageClient />;
}
