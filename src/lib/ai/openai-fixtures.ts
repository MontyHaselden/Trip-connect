import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

type FixtureFile = {
  content: string;
  recordedAt?: string;
  label?: string;
};

/** Stable key for a system+user prompt pair. */
export function openAiFixtureKey(system: string, user: string): string {
  return createHash("sha256").update(system).update("\n---\n").update(user).digest("hex").slice(0, 16);
}

function fixturePath(dir: string, key: string): string {
  return path.join(dir, `${key}.json`);
}

export function readOpenAiFixture(dir: string, key: string): string | null {
  const file = fixturePath(dir, key);
  if (!existsSync(file)) return null;
  const parsed = JSON.parse(readFileSync(file, "utf8")) as FixtureFile;
  return parsed.content;
}

export function writeOpenAiFixture(
  dir: string,
  key: string,
  content: string,
  meta?: { label?: string },
): void {
  mkdirSync(dir, { recursive: true });
  const payload: FixtureFile = {
    content,
    recordedAt: new Date().toISOString(),
    label: meta?.label,
  };
  writeFileSync(fixturePath(dir, key), `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

/** How many OpenAI calls a document import makes (outline + structure + one per day). */
export function documentImportAiCallCount(dayCount: number): number {
  return 2 + dayCount;
}
