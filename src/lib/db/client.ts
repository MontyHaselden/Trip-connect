import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

// Next.js may evaluate route modules during build. Avoid throwing on import so the build can run
// without runtime env configured. Runtime requests still require a real `DATABASE_URL`.
const databaseUrl =
  process.env.DATABASE_URL ??
  "postgres://postgres:postgres@localhost:5432/trip_connect";

const sql = neon(databaseUrl);

export const db = drizzle(sql);

