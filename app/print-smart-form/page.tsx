import { redirect } from "next/navigation";
import PrintSmartFormPageClient from "./PrintSmartFormPageClient";
import { resolvePrintSmartFormAccess } from "@/lib/printSmartFormAccess";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "AI 1분 인쇄물 뚝딱 생성기 | Studio Canvas AI",
  robots: { index: false, follow: false },
};

export default async function PrintSmartFormPage() {
  const access = await resolvePrintSmartFormAccess();
  if (access === "deny") redirect("/");
  return <PrintSmartFormPageClient />;
}
