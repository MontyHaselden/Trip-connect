import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

const COOKIE_NAME = "tc_admin_session";

export type AdminSessionPayload = {
  adminId: string;
  role: "super_admin" | "admin" | "support";
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

export function createAdminSessionCookie(payload: AdminSessionPayload): string {
  const secret = requireEnv("SESSION_SECRET");
  const json = JSON.stringify(payload);
  const data = b64urlEncode(Buffer.from(json, "utf8"));
  const sig = sign(data, secret);
  return `${data}.${sig}`;
}

export function verifyAdminSessionCookie(value: string): AdminSessionPayload | null {
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
    const parsed = JSON.parse(decoded) as AdminSessionPayload;
    if (!parsed.adminId || typeof parsed.adminId !== "string") return null;
    if (!["super_admin", "admin", "support"].includes(parsed.role)) return null;
    if (!parsed.issuedAt || typeof parsed.issuedAt !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function setAdminSessionCookie(params: {
  adminId: string;
  role: AdminSessionPayload["role"];
}) {
  const value = createAdminSessionCookie({
    adminId: params.adminId,
    role: params.role,
    issuedAt: Date.now(),
  });
  const jar = await cookies();
  jar.set(COOKIE_NAME, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearAdminSessionCookie() {
  const jar = await cookies();
  jar.set(COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export async function getAdminSession(): Promise<AdminSessionPayload | null> {
  const jar = await cookies();
  const value = jar.get(COOKIE_NAME)?.value;
  if (!value) return null;
  return verifyAdminSessionCookie(value);
}

export async function requireAdminSession(): Promise<AdminSessionPayload> {
  const session = await getAdminSession();
  if (!session) throw new Error("Unauthorized");
  return session;
}

export async function requireAdminSessionAdminId(): Promise<string> {
  const session = await requireAdminSession();
  return session.adminId;
}
