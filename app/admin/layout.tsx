import type { ReactNode } from "react";
import { getAdminSession } from "@/lib/adminAuth";
import AdminLoginForm from "@/components/AdminLoginForm";

export const dynamic = "force-dynamic";

/**
 * Gate all /admin routes behind the dedicated admin cookie session.
 * Shows AdminLoginForm instead of 404 when unauthenticated.
 */
export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await getAdminSession();
  if (!session) {
    return <AdminLoginForm />;
  }
  return children;
}
