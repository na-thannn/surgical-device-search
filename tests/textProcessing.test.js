import assert from "node:assert/strict";
import { test } from "node:test";

import {
  normalizeText,
  normalizedIncludes,
  splitSemiColonText,
  stripVietnamese
} from "../src/services/textProcessing.js";

test("stripVietnamese removes accents and maps Vietnamese d", () => {
  assert.equal(stripVietnamese("đầu hút rửa nội soi"), "dau hut rua noi soi");
  assert.equal(stripVietnamese("Đốt điện"), "Dot dien");
});

test("normalizeText lowercases, removes punctuation, and preserves useful symbols", () => {
  assert.equal(
    normalizeText(" Lấy dao siêu âm J&J vừa cắt/hàn mạch! "),
    "lay dao sieu am j&j vua cat/han mach"
  );
});

test("splitSemiColonText returns trimmed non-empty values", () => {
  assert.deepEqual(splitSemiColonText("dao siêu âm; ; cây harmonic ;"), [
    "dao siêu âm",
    "cây harmonic"
  ]);
});

test("normalizedIncludes matches accented and unaccented text", () => {
  assert.equal(normalizedIncludes("dao siêu âm J&J", "dao sieu am"), true);
  assert.equal(normalizedIncludes("kẹp hàn mạch", "sinh thiết"), false);
});
