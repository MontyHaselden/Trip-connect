import { redirect } from "next/navigation";

export default async function MobileJoinRedirectPage(props: {
  params: Promise<{ inviteCode: string }>;
}) {
  const { inviteCode } = await props.params;
  redirect(`/s/${encodeURIComponent(inviteCode)}`);
}
