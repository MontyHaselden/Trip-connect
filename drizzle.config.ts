import { defineConfig } from "drizzle-kit";

// `drizzle-kit generate` does not require a live DB connection, but `migrate` does.
// We keep a placeholder URL so generating migrations works even before env setup.
const databaseUrl =
  process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/trip_connect";

export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./src/lib/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl,
  },
});

