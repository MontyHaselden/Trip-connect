import { WizardClient } from "@/components/host/wizard/WizardClient";

export default async function TripWizardPage({
  params,
  searchParams,
}: {
  params: Promise<{ tripId: string }>;
  searchParams: Promise<{ step?: string }>;
}) {
  const { tripId } = await params;
  const { step } = await searchParams;
  const initialStep = Math.min(8, Math.max(1, Number(step) || 1));

  return <WizardClient tripId={tripId} initialStep={initialStep} />;
}
