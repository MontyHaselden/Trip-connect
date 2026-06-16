import { redirect } from "next/navigation";

import { getValidHostSession } from "@/lib/auth/host-session";

export default async function Dashboard1Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getValidHostSession();
  if (!session) redirect("/login");
  return children;
}
