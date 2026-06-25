import type { Metadata } from "next";

import { loadTripByAnyInviteCode } from "@/lib/join/load-trip-by-invite";

export async function generateMetadata(props: {
  params: Promise<{ inviteCode: string }>;
}): Promise<Metadata> {
  const { inviteCode } = await props.params;
  const trip = await loadTripByAnyInviteCode(inviteCode);
  const tripName = trip?.name ?? "Trip";
  return {
    title: `${tripName} — Join screen`,
  };
}

export default function JoinDisplayLayout(props: { children: React.ReactNode }) {
  return props.children;
}
