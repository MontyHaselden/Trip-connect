import { NextResponse } from "next/server";

import { tripOsHomePath } from "@/lib/trip-os/paths";

export async function GET(request: Request) {
  return NextResponse.redirect(new URL(tripOsHomePath(), request.url));
}
