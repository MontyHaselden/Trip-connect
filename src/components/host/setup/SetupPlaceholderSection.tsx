"use client";

import Link from "next/link";
import { useMemo } from "react";

import {
  emergencyStatusItems,
  photosViewersStatusItems,
  publishStatusItems,
  sectionStatusItems,
} from "@/lib/host/setup/section-status-items";
import type { SetupSectionId, SetupSectionReadiness, TripSetupState } from "@/lib/host/setup/types";

import { SetupAddsPanel } from "./SetupAddsPanel";
import { SetupSectionSplit } from "./SetupSectionSplit";
import { SetupSectionStatusPanel } from "./SetupSectionStatusPanel";

export function SetupPlaceholderSection(props: {
  sectionId: SetupSectionId;
  tripId: string;
  state: TripSetupState;
  activeGroupId: string;
  section?: SetupSectionReadiness;
}) {
  const { sectionId, tripId, state, activeGroupId, section } = props;

  const statusItems = useMemo(() => {
    if (sectionId === "emergency") return emergencyStatusItems();
    if (sectionId === "photos_viewers") return photosViewersStatusItems();
    if (sectionId === "publish") {
      return publishStatusItems(section?.message, section?.status);
    }
    return sectionStatusItems(sectionId, state, activeGroupId, section);
  }, [sectionId, state, activeGroupId, section]);

  return (
    <SetupSectionSplit
      status={<SetupSectionStatusPanel section={section} items={statusItems} />}
      adds={
        <SetupAddsPanel>
          <div className="space-y-4">
            {sectionId === "publish" ? (
              <p className="text-sm text-zinc-600">
                When setup is complete, publish from the{" "}
                <Link
                  href={`/dashboard/trips/${tripId}/builder`}
                  className="font-medium text-sky-800 underline"
                >
                  Builder
                </Link>
                .
              </p>
            ) : (
              <p className="text-sm text-zinc-500">
                {sectionId === "emergency"
                  ? "Emergency contacts and stay info — full editor coming soon."
                  : "Photos and viewer settings — full editor coming soon."}
              </p>
            )}
          </div>
        </SetupAddsPanel>
      }
    />
  );
}
