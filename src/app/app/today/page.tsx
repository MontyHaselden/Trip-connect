import { Suspense } from "react";
import { TodayClient } from "@/components/student/today/TodayClient";

export default function TodayPage() {
  return (
    <Suspense>
      <TodayClient />
    </Suspense>
  );
}

