import { desc, eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { hostAccounts, hostTripMembers, trips } from "@/lib/db/schema";
import { isTripCompleted } from "@/lib/host/trip-delete-eligibility";

export default async function AdminTripsPage() {
  const rows = await db
    .select({
      trip: trips,
      hostId: hostTripMembers.hostId,
      accountEmail: hostAccounts.email,
      accountName: hostAccounts.fullName,
    })
    .from(trips)
    .innerJoin(hostTripMembers, eq(hostTripMembers.tripId, trips.id))
    .innerJoin(hostAccounts, eq(hostAccounts.id, hostTripMembers.hostId))
    .orderBy(desc(trips.createdAt))
    .limit(300);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-zinc-900">Trips</h1>
      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-left text-xs uppercase text-zinc-500">
            <tr>
              <th className="px-4 py-3">Trip</th>
              <th className="px-4 py-3">Account</th>
              <th className="px-4 py-3">Dates</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.trip.id} className="border-t border-zinc-100">
                <td className="px-4 py-3 font-medium">{r.trip.name}</td>
                <td className="px-4 py-3">
                  <p>{r.accountName}</p>
                  <p className="text-xs text-zinc-500">{r.accountEmail}</p>
                </td>
                <td className="px-4 py-3">
                  {r.trip.startDate} – {r.trip.endDate}
                </td>
                <td className="px-4 py-3">
                  {isTripCompleted(r.trip) ? (
                    <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs">Completed</span>
                  ) : r.trip.publishedVersion === 0 ? (
                    <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-800">Building</span>
                  ) : (
                    <span className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-800">Active</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
