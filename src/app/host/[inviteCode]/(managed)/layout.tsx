import { redirect } from "next/navigation";

import { HostShell } from "@/components/layout/HostShell";
import { requireHostTripForInvite } from "@/lib/auth/require-host-trip";

export default async function ManagedHostLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ inviteCode: string }>;
}) {
  const { inviteCode } = await params;

  try {
    await requireHostTripForInvite(inviteCode);
  } catch {
    redirect(`/host/${encodeURIComponent(inviteCode)}`);
  }

  return <HostShell inviteCode={inviteCode}>{children}</HostShell>;
}
