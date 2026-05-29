import { TripAppShell } from "@/components/layout/TripAppShell";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <TripAppShell>{children}</TripAppShell>;
}

