import Link from "next/link";

export function PayShareSection() {
  return (
    <section className="py-16">
      <div className="mx-auto max-w-3xl rounded-2xl border border-zinc-200 bg-white px-6 py-8 sm:px-10">
        <h2 className="text-2xl font-semibold">Split a personal trip with PayShare</h2>
        <p className="mt-3 text-sm leading-relaxed text-zinc-600">
          For one-time personal trips, Trip Connect can use PayShare so the organiser does not have
          to pay the full trip setup cost alone.
        </p>
        <p className="mt-4 rounded-xl bg-sky-50 px-4 py-3 text-sm text-zinc-700">
          <span className="font-medium">Example:</span> A group of 6 friends creates a one-time
          Trip Connect plan for $18. With PayShare, each person can pay $3 and the trip unlocks once
          everyone has paid.
        </p>
        <ul className="mt-4 space-y-2 text-sm text-zinc-700">
          <li>Available for the one-time personal trip package</li>
          <li>Useful for friends, families, and small groups</li>
          <li>No one person has to cover the full cost</li>
          <li>Powered by PayShare</li>
        </ul>
        <Link
          href="/payshare"
          className="mt-6 inline-flex h-11 items-center justify-center rounded-xl border border-zinc-300 bg-white px-6 text-sm font-medium text-zinc-900"
        >
          Learn about PayShare
        </Link>
      </div>
    </section>
  );
}
