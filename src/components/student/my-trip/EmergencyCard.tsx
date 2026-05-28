"use client";

export function EmergencyCard(props: {
  tripName: string;
  schoolName: string;
  studentName: string;
  leadContact?: { name: string; role: string; phoneNumber: string } | null;
  hotel?: { name: string | null; address: string | null; nearestStation: string | null } | null;
}) {
  const { tripName, schoolName, studentName, leadContact, hotel } = props;

  return (
    <section className="rounded-2xl border border-red-200 bg-white p-5">
      <h2 className="text-base font-semibold text-red-900">Emergency card</h2>
      <div className="mt-3 space-y-3 text-sm text-zinc-800">
        <div>
          <div className="text-xs text-zinc-500">Trip</div>
          <div className="font-medium">{tripName}</div>
        </div>
        <div>
          <div className="text-xs text-zinc-500">School</div>
          <div className="font-medium">{schoolName}</div>
        </div>
        <div>
          <div className="text-xs text-zinc-500">Student</div>
          <div className="font-medium">{studentName}</div>
        </div>

        {leadContact ? (
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
            <div className="text-xs text-zinc-500">Lead contact</div>
            <div className="mt-1 font-medium text-zinc-900">{leadContact.name}</div>
            <div className="text-xs text-zinc-500">{leadContact.role}</div>
            <div className="mt-1 text-sm">{leadContact.phoneNumber}</div>
          </div>
        ) : null}

        {hotel ? (
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
            <div className="text-xs text-zinc-500">Tonight’s hotel</div>
            <div className="mt-1 font-medium text-zinc-900">
              {hotel.name ?? "—"}
            </div>
            {hotel.address ? <div className="mt-1">{hotel.address}</div> : null}
            {hotel.nearestStation ? (
              <div className="mt-1 text-xs text-zinc-600">
                Nearest station: {hotel.nearestStation}
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-950">
          <div className="font-medium">If something goes wrong</div>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
            <li>Stay calm and stay somewhere safe.</li>
            <li>Call a teacher or parent helper.</li>
            <li>
              Show this screen to a station worker, police officer, hotel staff,
              or shop worker.
            </li>
            <li>Use the phrases below if needed.</li>
            <li>If it is urgent, call the local emergency number.</li>
          </ol>
        </div>
      </div>
    </section>
  );
}

