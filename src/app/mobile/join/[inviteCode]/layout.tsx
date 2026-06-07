import { redirect } from "next/navigation";

export default async function MobileJoinLayout(props: {
  children: React.ReactNode;
  params: Promise<{ inviteCode: string }>;
}) {
  const { inviteCode } = await props.params;
  redirect(`/s/${encodeURIComponent(inviteCode)}`);
}
