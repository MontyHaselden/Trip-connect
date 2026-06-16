"use client";

import { StudentBottomSheet } from "@/components/student/StudentBottomSheet";
import { formatRoomGroupSummary } from "@/lib/student/my-trip-summary";

export function RoomGroupsSheet(props: {
  open: boolean;
  onClose: () => void;
  groups: Array<{ id: string; name: string; type: string }>;
  room:
    | null
    | {
        roomName: string;
        roommates: Array<{ id: string; fullName: string }>;
      };
}) {
  const { open, onClose, groups, room } = props;
  const summary = formatRoomGroupSummary({
    roomName: room?.roomName,
    groups,
  });

  return (
    <StudentBottomSheet open={open} onClose={onClose} title="My room & groups">
      <div className="space-y-5 pb-2 text-sm">
        {summary ? (
          <p className="text-[var(--student-text-muted)]">{summary}</p>
        ) : null}

        {room ? (
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.06em] text-[var(--student-text-muted)]">
              My room
            </div>
            <div className="mt-1 font-semibold text-[var(--student-text)]">{room.roomName}</div>
            {room.roommates.length ? (
              <div className="mt-3">
                <div className="text-xs font-medium text-[var(--student-text-muted)]">
                  Roommates
                </div>
                <ul className="mt-2 space-y-1.5">
                  {room.roommates.map((r) => (
                    <li
                      key={r.id}
                      className="rounded-lg bg-[var(--student-bg)] px-3 py-2 text-[var(--student-text)]"
                    >
                      {r.fullName}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}

        {groups.length ? (
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.06em] text-[var(--student-text-muted)]">
              My groups
            </div>
            <ul className="mt-2 space-y-2">
              {groups.map((g) => (
                <li
                  key={g.id}
                  className="rounded-xl border border-[var(--student-line)] bg-[var(--student-bg)] px-3 py-2.5"
                >
                  <div className="font-semibold text-[var(--student-text)]">{g.name}</div>
                  <div className="text-xs text-[var(--student-text-muted)]">{g.type}</div>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {!room && !groups.length ? (
          <p className="text-[var(--student-text-muted)]">No room or group assigned yet.</p>
        ) : null}
      </div>
    </StudentBottomSheet>
  );
}
