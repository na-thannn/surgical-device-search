import assert from "node:assert/strict";
import { test } from "node:test";

import { extractHints } from "../src/services/hintExtractor.js";

test("extractHints detects brand, function, and category hints for harmonic query", () => {
  const hints = extractHints("lấy dao siêu âm J&J vừa cắt vừa hàn mạch");

  assert.equal(hints.normalized_query, "lay dao sieu am j&j vua cat vua han mach");
  assert.deepEqual(hints.brands, ["J&J"]);
  assert.deepEqual(hints.functions, ["cut", "seal vessel"]);
  assert.deepEqual(hints.categories, ["ultrasonic", "vessel sealing"]);
});

test("extractHints handles unaccented Vietnamese terms", () => {
  const hints = extractHints("kim sinh thiet noi soi tieu hoa");

  assert.deepEqual(hints.brands, []);
  assert.deepEqual(hints.functions, ["biopsy"]);
  assert.deepEqual(hints.categories, ["laparoscopic", "endoscopy"]);
});

test("extractHints detects suction irrigation query", () => {
  const hints = extractHints("lấy cây hút rửa");

  assert.deepEqual(hints.functions, ["suction", "irrigation"]);
  assert.deepEqual(hints.categories, ["suction"]);
});

test("extractHints separates negated endoscopic terms from positive hints", () => {
  const hints = extractHints("cai tui lay benh pham noi soi khong phai endoscopic");

  assert.deepEqual(hints.negated_terms, ["endoscopic"]);
  assert.equal(hints.embedding_query, "cai tui lay benh pham");
  assert.deepEqual(hints.categories, ["specimen retrieval"]);
});

test("extractHints detects biopsy intent and negated specimen bag terms", () => {
  const hints = extractHints("phau thuat noi soi can lay mau mo nho gui giai phau benh khong phai tui benh pham");

  assert.deepEqual(hints.negated_terms, ["specimen retrieval"]);
  assert.ok(hints.functions.includes("biopsy"));
  assert.equal(hints.embedding_query, "phau thuat noi soi can lay mau mo nho gui giai phau benh");
});

test("extractHints detects irrigation intent and negated Yankauer terms", () => {
  const hints = extractHints("dung cu vua bom rua vua hut dich trong o bung khong phai dau hut yankauer");

  assert.deepEqual(hints.negated_terms, ["Yankauer"]);
  assert.deepEqual(hints.functions, ["suction", "irrigation"]);
  assert.equal(hints.embedding_query, "dung cu vua bom rua vua hut dich trong o bung");
});

test("extractHints keeps robotic suction positive while negating standard laparoscopic suction irrigation", () => {
  const hints = extractHints(
    "trong ca robot can dung cu hut rua de lam sach truong mo khong phai cay hut rua noi soi thuong"
  );

  assert.ok(hints.categories.includes("robotic"));
  assert.deepEqual(hints.negated_terms, ["laparoscopic suction"]);
  assert.equal(hints.embedding_query, "trong ca robot can dung cu hut rua de lam sach truong mo");
});

test("extractHints detects specimen container requests and negates retrieval bags", () => {
  const hints = extractHints("can hop dung benh pham gui giai phau benh khong phai tui endo lay benh pham");

  assert.ok(hints.functions.includes("contain specimen"));
  assert.ok(hints.categories.includes("specimen handling"));
  assert.deepEqual(hints.negated_terms, ["specimen retrieval"]);
  assert.equal(hints.embedding_query, "can hop dung benh pham gui giai phau benh");
});

test("extractHints detects atraumatic grasper intent while negating Babcock and clip applier", () => {
  const hints = extractHints("can kep giu mo nhe trong noi soi khong phai babcock khong phai clip applier");

  assert.ok(hints.functions.includes("hold tissue"));
  assert.ok(hints.categories.includes("atraumatic grasper"));
  assert.deepEqual(hints.negated_terms, ["Babcock", "clip"]);
  assert.equal(hints.embedding_query, "can kep giu mo nhe trong noi soi");
});

test("extractHints lets a later correction override an earlier negation", () => {
  const hints = extractHints(
    "can kep giu mo nhe trong noi soi khong phai babcock khong phai clip applier a thoi lay cua babcock di"
  );

  assert.deepEqual(hints.negated_terms, ["clip"]);
  assert.deepEqual(hints.corrected_terms, ["Babcock"]);
  assert.equal(hints.embedding_query, "can kep giu mo nhe trong noi soi a thoi lay cua babcock di");
});
