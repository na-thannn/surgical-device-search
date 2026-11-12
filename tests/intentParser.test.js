import assert from "node:assert/strict";
import { test } from "node:test";

import { parseSearchIntent } from "../src/services/intentParser.js";

test("parseSearchIntent keeps only the latest request after a correction marker", () => {
  const intent = parseSearchIntent("lay Babcock a khong lay grasper thuong");

  assert.equal(intent.mode, "single");
  assert.equal(intent.was_corrected, true);
  assert.equal(intent.intents.length, 1);
  assert.equal(intent.intents[0].text, "lay grasper thuong");
});

test("parseSearchIntent splits clear multi-device requests", () => {
  const intent = parseSearchIntent("lay dao sieu am va tui benh pham");

  assert.equal(intent.mode, "multi");
  assert.equal(intent.is_multi_intent, true);
  assert.deepEqual(
    intent.intents.map(item => item.text),
    ["lay dao sieu am", "tui benh pham"]
  );
});

test("parseSearchIntent marks alternatives as ambiguous choices", () => {
  const intent = parseSearchIntent("babcock hoac grasper thuong cung duoc");

  assert.equal(intent.mode, "ambiguous");
  assert.equal(intent.is_ambiguous, true);
  assert.deepEqual(
    intent.intents.map(item => item.text),
    ["babcock", "grasper thuong"]
  );
});
