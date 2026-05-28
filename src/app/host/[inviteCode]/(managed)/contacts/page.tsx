import { ContactsClient } from "@/components/host/contacts/ContactsClient";

export default function HostContactsPage({
  params,
}: {
  params: { inviteCode: string };
}) {
  return <ContactsClient inviteCode={params.inviteCode} />;
}
