"use client";

import { PhotoUploadTile } from "./PhotoUploadTile";

/** @deprecated Use PhotoUploadTile directly */
export function DayPhotoUpload(props: {
  tripId: string;
  tripDayId: string;
  type: "selfie" | "place";
  label: string;
  onUploaded: () => void;
}) {
  const { tripId, tripDayId, type, label, onUploaded } = props;

  return (
    <PhotoUploadTile
      tripId={tripId}
      tripDayId={tripDayId}
      type={type}
      title={label}
      helper="Tap to add today's photo"
      onUploaded={onUploaded}
    />
  );
}
