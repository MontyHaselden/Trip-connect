"use client";

function formatTelHref(phone: string) {
  return `tel:${phone}`;
}

function formatSmsHref(phone: string) {
  return `sms:${phone}`;
}

export function KeyContacts(props: {
  contacts: Array<{
    id: string;
    name: string;
    role: string;
    phoneNumber: string;
  }>;
}) {
  const { contacts } = props;

  if (!contacts.length) return null;

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-5">
      <h2 className="text-base font-semibold">Key contacts</h2>
      <div className="mt-3 flex flex-col gap-3">
        {contacts.map((c) => (
          <div key={c.id} className="rounded-xl border border-zinc-200 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-medium text-zinc-900">{c.name}</div>
                <div className="text-xs text-zinc-500">{c.role}</div>
                <div className="mt-1 text-sm text-zinc-700">{c.phoneNumber}</div>
              </div>
              <div className="flex flex-col gap-2">
                <a
                  href={formatTelHref(c.phoneNumber)}
                  className="inline-flex h-10 items-center justify-center rounded-xl border border-zinc-200 bg-white px-3 text-sm font-medium"
                >
                  Call
                </a>
                <a
                  href={formatSmsHref(c.phoneNumber)}
                  className="inline-flex h-10 items-center justify-center rounded-xl border border-zinc-200 bg-white px-3 text-sm font-medium"
                >
                  Text
                </a>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

