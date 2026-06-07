"use client";

import { useEffect } from "react";

import {
  buildTripManifestHref,
  wirePwaHead,
} from "@/lib/mobile/wire-pwa-head";

export function TripPwaHead(props: { tripName: string; startUrl: string }) {
  const { tripName, startUrl } = props;

  useEffect(() => {
    wirePwaHead({
      manifestHref: buildTripManifestHref(tripName, startUrl),
      appTitle: tripName,
    });
  }, [tripName, startUrl]);

  return null;
}
