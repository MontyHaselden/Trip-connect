import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import {
  documentImportAiCallCount,
  openAiFixtureKey,
  readOpenAiFixture,
  writeOpenAiFixture,
} from "@/lib/ai/openai-fixtures";

describe("openAiFixtureKey", () => {
  it("is stable for the same prompts", () => {
    const a = openAiFixtureKey("system", "user");
    const b = openAiFixtureKey("system", "user");
    assert.equal(a, b);
    assert.notEqual(a, openAiFixtureKey("system", "user2"));
  });
});

describe("openAi fixture files", () => {
  it("writes and reads JSON fixtures", () => {
    const dir = mkdtempSync(join(tmpdir(), "openai-fixture-"));
    const key = "abc123";
    writeOpenAiFixture(dir, key, '{"items":[]}', { label: "day items" });
    assert.equal(readOpenAiFixture(dir, key), '{"items":[]}');
    const raw = JSON.parse(readFileSync(join(dir, `${key}.json`), "utf8")) as {
      label?: string;
    };
    assert.equal(raw.label, "day items");
  });
});

describe("documentImportAiCallCount", () => {
  it("counts outline + structure + per-day calls", () => {
    assert.equal(documentImportAiCallCount(14), 16);
  });
});
