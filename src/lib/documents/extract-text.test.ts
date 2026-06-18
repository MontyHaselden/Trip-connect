import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { configurePdfJsForServer } from "./configure-pdfjs-server";
import { extractTextFromUpload } from "./extract-text";

describe("configurePdfJsForServer", () => {
  it("preloads the worker without Next externals path errors", async () => {
    await assert.doesNotReject(() => configurePdfJsForServer());
    assert.ok(globalThis.pdfjsWorker?.WorkerMessageHandler);
  });
});

describe("extractTextFromUpload", () => {
  it("preserves line breaks in pasted text files", async () => {
    const raw = [
      "DAY DATE LOCATION",
      "Tuesday 16th Christchurch Plane",
      "Wednesday 17th London Plane",
      "Thursday 18th London",
      "Friday 19th Pisa Plane",
      "Saturday 20th La Spezia Bus",
    ].join("\n");
    const file = new File([raw], "pasted-itinerary.txt", { type: "text/plain" });
    const text = await extractTextFromUpload(file, { minTextLength: 20 });
    assert.match(text, /Tuesday 16th Christchurch/);
    assert.match(text, /\nWednesday 17th London/);
  });

  it("extracts text from the Thailand fixture PDF when present", async () => {
    const fixture = path.join(
      process.env.HOME ?? "",
      "Downloads/thailand_trip_rough_itinerary.pdf",
    );
    if (!fs.existsSync(fixture)) return;

    const file = new File([fs.readFileSync(fixture)], "thailand_trip_rough_itinerary.pdf", {
      type: "application/pdf",
    });
    const text = await extractTextFromUpload(file, { minTextLength: 50 });
    assert.ok(text.length >= 50);
    assert.match(text, /Thailand|Bangkok|Patong/i);
  });
});
