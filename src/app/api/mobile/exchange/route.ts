import { NextResponse } from "next/server";
import { z } from "zod";

import { exchangeMobileToken } from "@/lib/mobile/exchange";

const BodySchema = z.object({
  token: z.string().min(16).max(128),
});

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const result = await exchangeMobileToken(parsed.data.token);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(result);
}
