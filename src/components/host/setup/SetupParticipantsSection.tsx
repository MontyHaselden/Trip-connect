"use client";

import Link from "next/link";
import { useMemo } from "react";

import { participantsStatusItems } from "@/lib/host/setup/section-status-items";

import { SetupAddsPanel } from "./SetupAddsPanel";
import { SetupSectionSplit } from "./SetupSectionSplit";
import { SetupSectionStatusPanel } from "./SetupSectionStatusPanel";

export function SetupParticipantsSection(props: {
  tripId: string;
  inviteCode: string;
  sectionLabel?: string;
  sectionMessage?: string;
}) {
  const { tripId, inviteCode, sectionLabel, sectionMessage } = props;
  const statusItems = useMemo(() => participantsStatusItems(), []);
  const joinUrl = `/join/${inviteCode}`;

  return (
    <SetupSectionSplit
      status={
        <SetupSectionStatusPanel
          section={
            sectionLabel
              ? { id: "participants", label: sectionLabel, status: "todo", message: sectionMessage }
              : undefined
          }
          items={statusItems}
        />
      }
      adds={
        <SetupAddsPanel>
          <div className="space-y-4">
            <div className="rounded-lg border border-zinc-200 bg-white p-4">
              <h3 className="text-sm font-medium text-zinc-900">Invite link</h3>
              <p className="mt-1 break-all text-sm text-zinc-600">{joinUrl}</p>
              <p className="mt-2 text-xs text-zinc-500">
                Share this link so students and staff can join the trip.
              </p>
            </div>

            <div className="rounded-lg border border-zinc-200 bg-white p-4 text-sm">
              <p className="text-zinc-600">
                Manage roster, rooming, and group assignments on the{" "}
                <Link
                  href={`/dashboard/trips/${tripId}/participants`}
                  className="font-medium text-sky-800 underline"
                >
                  Participants
                </Link>{" "}
                page.
              </p>
            </div>
          </div>
        </SetupAddsPanel>
      }
    />
  );
}
