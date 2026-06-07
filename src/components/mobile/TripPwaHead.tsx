"use client";

import { useEffect } from "react";

import {
  buildTripManifestHref,
  wirePwaHead,
} from "@/lib/mobile/wire-pwa-head";

export function TripPwaHead(props: {
  tripName: string;
  startUrl: string;
  manifestId?: string;
}) {
  const { tripName, startUrl, manifestId } = props;

  useEffect(() => {
    wirePwaHead({
      manifestHref: buildTripManifestHref(tripName, startUrl, manifestId ?? startUrl),
      appTitle: tripName,
    });
  }, [tripName, startUrl, manifestId]);

  return null;
}
