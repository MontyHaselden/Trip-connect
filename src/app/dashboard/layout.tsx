import { redirect } from "next/navigation";

import { BillingTrialBanner } from "@/components/dashboard/BillingTrialBanner";
import { getValidHostSession } from "@/lib/auth/host-session";

export default async function Dashboard1Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getValidHostSession();
  if (!session) redirect("/login");
  return (
    <>
      <BillingTrialBanner />
      {children}
    </>
  );
}
