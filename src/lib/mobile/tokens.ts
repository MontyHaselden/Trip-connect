import { createHash, randomBytes } from "crypto";
import { and, eq, gt } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { mobileAccessTokens } from "@/lib/db/schema";

export type MobileTokenPurpose = "host_admin" | "host_trip" | "student_invite";

const TOKEN_TTL_DAYS = 90;

function hashToken(raw: string) {
  return createHash("sha256").update(raw).digest("hex");
}

function expiresAt() {
  const d = new Date();
  d.setDate(d.getDate() + TOKEN_TTL_DAYS);
  return d;
}

export async function createMobileAccessToken(params: {
  tripId: string;
  hostId?: string | null;
  participantId?: string | null;
  purpose: MobileTokenPurpose;
}) {
  const raw = randomBytes(32).toString("hex");
  const tokenHash = hashToken(raw);

  await db.insert(mobileAccessTokens).values({
    tripId: params.tripId,
    hostId: params.hostId ?? null,
    participantId: params.participantId ?? null,
    purpose: params.purpose,
    tokenHash,
    expiresAt: expiresAt(),
  });

  return raw;
}

export async function rotateMobileAccessToken(params: {
  tripId: string;
  hostId: string;
  purpose: Extract<MobileTokenPurpose, "host_admin" | "host_trip">;
}) {
  await db
    .delete(mobileAccessTokens)
    .where(
      and(
        eq(mobileAccessTokens.tripId, params.tripId),
        eq(mobileAccessTokens.purpose, params.purpose),
        eq(mobileAccessTokens.hostId, params.hostId),
      ),
    );

  return createMobileAccessToken({
    tripId: params.tripId,
    hostId: params.hostId,
    purpose: params.purpose,
  });
}

export async function findValidMobileToken(raw: string) {
  const tokenHash = hashToken(raw);
  const now = new Date();

  const row = await db
    .select()
    .from(mobileAccessTokens)
    .where(
      and(
        eq(mobileAccessTokens.tokenHash, tokenHash),
        gt(mobileAccessTokens.expiresAt, now),
      ),
    )
    .limit(1)
    .then((rows) => rows[0] ?? null);

  return row;
}

export function mobileLinkPath(purpose: MobileTokenPurpose, token: string) {
  if (purpose === "host_admin") return `/mobile/admin/${token}`;
  if (purpose === "host_trip") return `/mobile/trip/host/${token}`;
  return `/mobile/join/${token}`;
}

export function absoluteMobileUrl(origin: string, path: string) {
  return `${origin.replace(/\/$/, "")}${path}`;
}
