"use client";

export function MyGroupsRooms(props: {
  groups: Array<{ id: string; name: string; type: string }>;
  room:
    | null
    | {
        roomName: string;
        roommates: Array<{ id: string; fullName: string }>;
      };
}) {
  const { groups, room } = props;

  const hasRoom = Boolean(room);
  const hasGroups = groups.length > 0;

  if (!hasRoom && !hasGroups) return null;

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-5">
      <h2 className="text-base font-semibold">My groups / room</h2>

      {room ? (
        <div className="mt-3">
          <div className="text-sm font-medium text-zinc-900">My room</div>
          <div className="mt-1 text-sm text-zinc-700">{room.roomName}</div>
          {room.roommates.length ? (
            <div className="mt-3">
              <div className="text-sm font-medium text-zinc-900">Roommates</div>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-zinc-800">
                {room.roommates.map((r) => (
                  <li key={r.id}>{r.fullName}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      {groups.length ? (
        <div className={room ? "mt-5" : "mt-3"}>
          <div className="text-sm font-medium text-zinc-900">My groups</div>
          <ul className="mt-2 space-y-2 text-sm text-zinc-800">
            {groups.map((g) => (
              <li key={g.id} className="rounded-xl border border-zinc-200 bg-white px-3 py-2">
                <div className="font-medium">{g.name}</div>
                <div className="text-xs text-zinc-500">{g.type}</div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

