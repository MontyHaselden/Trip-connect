import { NextResponse } from "next/server";
import { z } from "zod";

const BodySchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(200),
  organisationName: z.string().trim().min(2).max(200),
  message: z.string().trim().max(2000).optional(),
});

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  // Placeholder: log interest until CRM/email integration is wired.
  console.info("[organisation-interest]", parsed.data);

  return NextResponse.json({
    ok: true,
    message:
      "Thanks for registering interest. Organisation plans are coming later — we'll be in touch.",
  });
}
