"use client";

import { useParams } from "next/navigation";

import { TeamClient } from "@/components/host/team/TeamClient";

export default function TeamPage() {
  const params = useParams();
  const inviteCode = String(params.inviteCode ?? "");
  return <TeamClient inviteCode={inviteCode} />;
}
