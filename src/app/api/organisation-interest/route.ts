import { NextResponse } from "next/server";
import { z } from "zod";

import { getSupportEmail, sendEmail } from "@/lib/email/send-email";

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

  const data = parsed.data;
  const supportEmail = await getSupportEmail();
  const text = [
    "Organisation interest (Itinerary Live)",
    "",
    `Name: ${data.fullName}`,
    `Email: ${data.email}`,
    `Organisation: ${data.organisationName}`,
    data.message ? `Message: ${data.message}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const sent = await sendEmail({
    to: supportEmail,
    subject: `Organisation interest — ${data.organisationName}`,
    text,
  });

  if (!sent.ok) {
    console.info("[organisation-interest]", data);
    return NextResponse.json({
      ok: true,
      message: `Thanks — organisation plans are coming later. Email us directly at ${supportEmail} so we don't miss you.`,
    });
  }

  return NextResponse.json({
    ok: true,
    message:
      "Thanks for registering interest. Organisation plans are coming later — we'll be in touch by email.",
  });
}
