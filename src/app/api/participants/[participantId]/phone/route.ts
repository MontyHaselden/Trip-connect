import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/lib/db/client";
import { participants } from "@/lib/db/schema";

const BodySchema = z.object({
  phoneNumberE164: z.string().trim().min(8).max(20),
});

export async function POST(
  req: Request,
  ctx: { params: Promise<{ participantId: string }> },
) {
  const { participantId } = await ctx.params;
  try {
    const auth = req.headers.get("authorization");
    const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const json = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid phone number." }, { status: 400 });
    }

    const existing = await db
      .select({ id: participants.id })
      .from(participants)
      .where(
        and(eq(participants.id, participantId), eq(participants.accessToken, token)),
      )
      .limit(1)
      .then((rows) => rows[0] ?? null);

    if (!existing) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const [updated] = await db
      .update(participants)
      .set({ phoneNumberE164: parsed.data.phoneNumberE164, updatedAt: new Date() })
      .where(eq(participants.id, participantId))
      .returning({ phoneNumberE164: participants.phoneNumberE164 });

    return NextResponse.json(updated);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Update failed." },
      { status: 500 },
    );
  }
}
