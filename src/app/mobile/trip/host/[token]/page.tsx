import { MobileTokenEntry } from "@/components/mobile/MobileTokenEntry";

export default async function MobileHostTripEntryPage(props: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await props.params;
  return (
    <MobileTokenEntry
      token={token}
      purpose="host_trip"
      startUrl={`/mobile/trip/host/${token}`}
    />
  );
}
