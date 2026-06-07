import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

import { AdminShell } from "@/components/admin/AdminShell";
import { getAdminById } from "@/lib/admin/auth";
import { requireAdminSession } from "@/lib/auth/admin-session";

export default async function AdminProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let session;
  try {
    session = await requireAdminSession();
  } catch {
    redirect("/admin/login");
  }

  const admin = await getAdminById(session.adminId);
  if (!admin) redirect("/admin/login");

  return (
    <AdminShell adminName={admin.fullName} adminRole={admin.role}>
      {children}
    </AdminShell>
  );
}
