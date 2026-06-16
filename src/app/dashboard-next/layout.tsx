import { redirect } from "next/navigation";

import { getHostSession } from "@/lib/auth/host-session";

export default async function DashboardNextLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getHostSession();
  if (!session) redirect("/login");
  return children;
}
