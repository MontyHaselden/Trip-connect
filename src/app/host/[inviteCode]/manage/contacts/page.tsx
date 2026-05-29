import { ContactsClient } from "@/components/host/contacts/ContactsClient";

export default async function HostContactsPage({
  params,
}: {
  params: Promise<{ inviteCode: string }>;
}) {
  const { inviteCode } = await params;
  return <ContactsClient inviteCode={inviteCode} />;
}
