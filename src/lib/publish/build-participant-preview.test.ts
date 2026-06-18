import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { computeParticipantPreviewMeta } from "@/lib/publish/build-participant-preview";

describe("computeParticipantPreviewMeta", () => {
  it("marks live when published and draft matches", () => {
    const meta = computeParticipantPreviewMeta({
      publishedVersion: 2,
      staleVsPublished: false,
    });
    assert.equal(meta.liveForStudents, true);
    assert.equal(meta.staleVsPublished, false);
  });

  it("marks stale when published but draft changed", () => {
    const meta = computeParticipantPreviewMeta({
      publishedVersion: 2,
      staleVsPublished: true,
    });
    assert.equal(meta.liveForStudents, false);
    assert.equal(meta.staleVsPublished, true);
  });

  it("never live for students when never published", () => {
    const meta = computeParticipantPreviewMeta({
      publishedVersion: 0,
      staleVsPublished: true,
    });
    assert.equal(meta.liveForStudents, false);
    assert.equal(meta.staleVsPublished, true);
  });
});
