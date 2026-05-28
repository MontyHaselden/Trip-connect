import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is required`);
  return v;
}

const sql = neon(requireEnv("DATABASE_URL"));

export const db = drizzle(sql);

