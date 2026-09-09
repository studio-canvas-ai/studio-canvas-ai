import PrintStudioPageClient from "./PrintStudioPageClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "AI 인쇄물 스튜디오 | Studio Canvas AI",
  robots: { index: false, follow: false },
};

export default function PrintStudioPage() {
  return <PrintStudioPageClient />;
}
