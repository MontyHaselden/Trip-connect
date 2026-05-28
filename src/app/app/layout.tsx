import { StudentAppShell } from "@/components/layout/StudentAppShell";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <StudentAppShell>{children}</StudentAppShell>;
}

