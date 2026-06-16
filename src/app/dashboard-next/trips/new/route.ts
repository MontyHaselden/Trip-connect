import { NextResponse } from "next/server";

import { tripOsNewTripPath } from "@/lib/trip-os/paths";

export async function GET(request: Request) {
  return NextResponse.redirect(new URL(tripOsNewTripPath(), request.url));
}
