import { LegacyAppRedirect } from "@/components/layout/LegacyAppRedirect";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <LegacyAppRedirect />
      {children}
    </>
  );
}
