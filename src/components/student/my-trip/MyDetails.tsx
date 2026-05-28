"use client";

export function MyDetails(props: {
  fullName: string;
  phoneNumberE164: string;
  role: string;
}) {
  const { fullName, phoneNumberE164, role } = props;
  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-5">
      <h2 className="text-base font-semibold">My details</h2>
      <div className="mt-3 space-y-2 text-sm">
        <div>
          <div className="text-xs text-zinc-500">Name</div>
          <div className="font-medium text-zinc-900">{fullName}</div>
        </div>
        <div>
          <div className="text-xs text-zinc-500">Phone</div>
          <div className="font-medium text-zinc-900">{phoneNumberE164}</div>
        </div>
        <div>
          <div className="text-xs text-zinc-500">Role</div>
          <div className="font-medium text-zinc-900">{role}</div>
        </div>
      </div>
      <button
        type="button"
        disabled
        className="mt-4 inline-flex h-10 w-full items-center justify-center rounded-xl border border-zinc-200 bg-white text-sm font-medium text-zinc-400"
      >
        Edit my phone number (coming soon)
      </button>
    </section>
  );
}

