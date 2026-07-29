import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { getAdminSession } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await getAdminSession();
  if (!session) notFound();
  return children;
}
