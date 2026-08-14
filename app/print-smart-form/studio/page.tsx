import { redirect } from "next/navigation";
import PrintStudioPageClient from "./PrintStudioPageClient";
import { resolvePrintSmartFormAccess } from "@/lib/printSmartFormAccess";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "AI 인쇄물 스튜디오 | Studio Canvas AI",
  robots: { index: false, follow: false },
};

export default async function PrintStudioPage() {
  const access = await resolvePrintSmartFormAccess();
  if (access === "deny") redirect("/");
  return <PrintStudioPageClient />;
}
