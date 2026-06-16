import { randomBytes } from "crypto";

export function generateAccessToken(): string {
  return randomBytes(32).toString("hex");
}

export function generateInviteCode(length = 6): string {
  return randomBytes(Math.ceil(length / 2))
    .toString("hex")
    .slice(0, length)
    .toLowerCase();
}

