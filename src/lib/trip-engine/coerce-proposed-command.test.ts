import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { coerceProposedCommands } from "./coerce-proposed-command";

const groupId = "00000000-0000-4000-8000-000000000001";

describe("coerceProposedCommands", () => {
  it("coerces flat addActivity entries missing type", () => {
    const { commands, warnings } = coerceProposedCommands(
      [
        {
          title: "Kimono Hire",
          date: "2026-12-17",
          locationName: "Kyoto",
        },
      ],
      groupId,
    );
    assert.equal(warnings.length, 0);
    assert.equal(commands.length, 1);
    assert.equal(commands[0]?.type, "addActivity");
    if (commands[0]?.type === "addActivity") {
      assert.equal(commands[0].activity.title, "Kimono Hire");
      assert.equal(commands[0].activity.date, "2026-12-17");
      assert.equal(commands[0].groupId, groupId);
    }
  });

  it("coerces nested activity objects missing type", () => {
    const { commands } = coerceProposedCommands(
      [
        {
          activity: {
            title: "Peace Park",
            date: "2026-12-20",
          },
        },
      ],
      groupId,
    );
    assert.equal(commands.length, 1);
    assert.equal(commands[0]?.type, "addActivity");
  });

  it("expands activities arrays", () => {
    const { commands } = coerceProposedCommands(
      [
        {
          activities: [
            { title: "One", date: "2026-12-17" },
            { title: "Two", date: "2026-12-18" },
          ],
        },
      ],
      groupId,
    );
    assert.equal(commands.length, 2);
    assert.ok(commands.every((command) => command.type === "addActivity"));
  });

  it("warns on entries with no recognizable command", () => {
    const { commands, warnings } = coerceProposedCommands([{ foo: "bar" }], groupId);
    assert.equal(commands.length, 0);
    assert.equal(warnings.length, 1);
  });
});
