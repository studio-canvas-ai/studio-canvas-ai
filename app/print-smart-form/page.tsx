import PrintSmartFormPageClient from "./PrintSmartFormPageClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "AI 1분 인쇄물 뚝딱 생성기 | Studio Canvas AI",
  robots: { index: false, follow: false },
};

export default function PrintSmartFormPage() {
  return <PrintSmartFormPageClient />;
}
