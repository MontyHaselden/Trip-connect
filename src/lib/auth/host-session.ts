import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

const COOKIE_NAME = "tc_host_session";

type HostSessionPayload = {
  tripId: string;
  issuedAt: number;
};

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is required`);
  return v;
}

function b64urlEncode(buf: Buffer): string {
  return buf
    .toString("base64")
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function b64urlDecode(s: string): Buffer {
  const normalized = s.replaceAll("-", "+").replaceAll("_", "/");
  const pad = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  return Buffer.from(normalized + pad, "base64");
}

function sign(data: string, secret: string): string {
  return b64urlEncode(createHmac("sha256", secret).update(data).digest());
}

export function createHostSessionCookie(payload: HostSessionPayload): string {
  const secret = requireEnv("SESSION_SECRET");
  const json = JSON.stringify(payload);
  const data = b64urlEncode(Buffer.from(json, "utf8"));
  const sig = sign(data, secret);
  return `${data}.${sig}`;
}

export function verifyHostSessionCookie(value: string): HostSessionPayload | null {
  const secret = requireEnv("SESSION_SECRET");
  const parts = value.split(".");
  if (parts.length !== 2) return null;
  const [data, sig] = parts;
  if (!data || !sig) return null;

  const expected = sign(data, secret);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const decoded = b64urlDecode(data).toString("utf8");
    const parsed = JSON.parse(decoded) as HostSessionPayload;
    if (!parsed.tripId || typeof parsed.tripId !== "string") return null;
    if (!parsed.issuedAt || typeof parsed.issuedAt !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function setHostSessionCookie(tripId: string) {
  const value = createHostSessionCookie({ tripId, issuedAt: Date.now() });
  const jar = await cookies();
  jar.set(COOKIE_NAME, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
}

export async function clearHostSessionCookie() {
  const jar = await cookies();
  jar.set(COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export async function requireHostSessionTripId(): Promise<string> {
  const jar = await cookies();
  const value = jar.get(COOKIE_NAME)?.value;
  if (!value) throw new Error("Unauthorized");
  const payload = verifyHostSessionCookie(value);
  if (!payload) throw new Error("Unauthorized");
  return payload.tripId;
}

