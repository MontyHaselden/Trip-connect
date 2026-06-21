import Link from "next/link";

export default function StudentInviteNotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-[var(--student-bg)] px-6 py-16 text-center">
      <p className="text-sm font-medium text-[var(--student-text)]">This join link isn&apos;t valid</p>
      <p className="mt-2 max-w-sm text-sm text-[var(--student-text-muted)]">
        It may be from an old trip or typed incorrectly. Ask your organiser for the current
        link from Trip OS → Join links.
      </p>
      <Link
        href="/"
        className="mt-6 rounded-full bg-violet-600 px-5 py-2.5 text-sm font-medium text-white"
      >
        Go to Trip Connect
      </Link>
    </div>
  );
}
