import { NextResponse } from "next/server";

export async function POST(
  _req: Request,
  _ctx: { params: Promise<{ inviteCode: string }> },
) {
  return NextResponse.json(
    {
      error:
        "Host-code login is deprecated. Please sign in on the home page using your host account.",
    },
    { status: 400 },
  );
}

