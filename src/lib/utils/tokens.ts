import { randomBytes } from "crypto";

export function generateAccessToken(): string {
  return randomBytes(32).toString("hex");
}

