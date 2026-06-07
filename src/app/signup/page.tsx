import { Suspense } from "react";

import { AuthForm } from "@/components/auth/AuthForm";

export default function SignupPage() {
  return (
    <Suspense fallback={<p className="p-10 text-center text-sm text-zinc-600">Loading…</p>}>
      <AuthForm mode="signup" />
    </Suspense>
  );
}
