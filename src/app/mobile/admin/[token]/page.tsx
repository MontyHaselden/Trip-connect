import { MobileTokenEntry } from "@/components/mobile/MobileTokenEntry";

export default async function MobileAdminEntryPage(props: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await props.params;
  return (
    <MobileTokenEntry
      token={token}
      purpose="host_admin"
      startUrl={`/mobile/admin/${token}`}
    />
  );
}
