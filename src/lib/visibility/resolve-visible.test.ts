import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  filterEntitiesForParticipant,
  isVisibleToParticipant,
  isVisibleToViewer,
} from "./resolve-visible";
import type { PublishedVisibilityTarget } from "./types";

const ctx = {
  participantId: "p1",
  role: "student" as const,
  groupIds: new Set(["g-kagoshima"]),
  roomId: "r1",
};

const targets: PublishedVisibilityTarget[] = [
  {
    entityType: "itinerary_item",
    entityId: "item-group",
    targetType: "group",
    targetId: "g-kagoshima",
  },
  {
    entityType: "itinerary_item",
    entityId: "item-other",
    targetType: "group",
    targetId: "g-tottori",
  },
  {
    entityType: "itinerary_item",
    entityId: "item-multi",
    targetType: "group",
    targetId: "g-kagoshima",
  },
  {
    entityType: "itinerary_item",
    entityId: "item-multi",
    targetType: "group",
    targetId: "g-tottori",
  },
];

describe("isVisibleToParticipant", () => {
  it("shows everyone items to all students", () => {
    assert.equal(
      isVisibleToParticipant({ id: "a", visibilityMode: "everyone" }, ctx),
      true,
    );
  });

  it("hides hidden_from_students", () => {
    assert.equal(
      isVisibleToParticipant({ id: "a", visibilityMode: "hidden_from_students" }, ctx),
      false,
    );
  });

  it("shows staff_only to teachers", () => {
    assert.equal(
      isVisibleToParticipant(
        { id: "a", visibilityMode: "staff_only" },
        { ...ctx, role: "teacher" },
      ),
      true,
    );
    assert.equal(
      isVisibleToParticipant({ id: "a", visibilityMode: "staff_only" }, ctx),
      false,
    );
  });

  it("shows custom group items only to matching group", () => {
    assert.equal(
      isVisibleToParticipant(
        { id: "item-group", visibilityMode: "custom" },
        ctx,
        [{ targetType: "group", targetId: "g-kagoshima" }],
      ),
      true,
    );
    assert.equal(
      isVisibleToParticipant(
        { id: "item-other", visibilityMode: "custom" },
        ctx,
        [{ targetType: "group", targetId: "g-tottori" }],
      ),
      false,
    );
  });

  it("supports legacy audience_type fallback", () => {
    assert.equal(
      isVisibleToParticipant(
        {
          id: "legacy",
          visibilityMode: "custom",
          audienceType: "group",
          audienceId: "g-kagoshima",
        },
        ctx,
        [],
      ),
      true,
    );
  });
});

describe("filterEntitiesForParticipant", () => {
  it("filters itinerary items by group membership", () => {
    const items = [
      { id: "item-group", visibilityMode: "custom" as const, title: "K" },
      { id: "item-other", visibilityMode: "custom" as const, title: "T" },
      { id: "item-all", visibilityMode: "everyone" as const, title: "All" },
    ];
    const filtered = filterEntitiesForParticipant(
      items,
      "itinerary_item",
      targets,
      ctx,
    );
    assert.deepEqual(
      filtered.map((i) => i.id),
      ["item-group", "item-all"],
    );
  });
});

describe("isVisibleToViewer", () => {
  it("shows viewers_only to viewer filter", () => {
    assert.equal(
      isVisibleToViewer({ id: "v", visibilityMode: "viewers_only" }),
      true,
    );
    assert.equal(
      isVisibleToViewer({ id: "h", visibilityMode: "hidden_from_students" }),
      false,
    );
  });
});
