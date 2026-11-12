import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { test } from "node:test";

import { extractHints } from "../src/services/hintExtractor.js";
import { findLexicalCandidates } from "../src/services/lexicalSearchService.js";

test("findLexicalCandidates finds an alias match even when text is unaccented", () => {
  const hints = extractHints("kim sinh thiet noi soi tieu hoa");
  const candidates = findLexicalCandidates(
    [
      {
        device_id: "DEV042",
        official_name: "Endoscopic biopsy forceps",
        aliases_vi_text: "kìm sinh thiết; forceps sinh thiết; kẹp lấy mẫu nội soi",
        aliases_en_text: "biopsy forceps; endoscopic biopsy forceps",
        functions_text: "take biopsy; grasp tissue; retrieve sample",
        category: "Endoscopy accessory",
        sub_category: "Biopsy forceps"
      },
      {
        device_id: "DEV017",
        official_name: "Endoscopic retrieval bag",
        aliases_vi_text: "túi lấy bệnh phẩm; túi endo",
        functions_text: "retrieve specimen; contain tissue",
        category: "Specimen retrieval",
        sub_category: "Endoscopic bag"
      }
    ],
    hints,
    5
  );

  assert.equal(candidates[0].payload.device_id, "DEV042");
  assert.ok(candidates[0].score > 0.8);
});

test("findLexicalCandidates prioritizes biopsy forceps over generic surgical items for pathology sample requests", () => {
  const hints = extractHints("phau thuat noi soi can lay mau mo nho gui giai phau benh khong phai tui benh pham");
  const candidates = findLexicalCandidates(
    [
      {
        device_id: "DEV052",
        official_name: "Yankauer suction tip",
        aliases_vi_text: "ong hut phau thuat",
        aliases_en_text: "Yankauer suction tip",
        functions_text: "suction; clear blood; clear fluid",
        category: "Suction",
        sub_category: "Rigid suction tip"
      },
      {
        device_id: "DEV042",
        official_name: "Endoscopic biopsy forceps",
        aliases_vi_text: "kim sinh thiet; forceps sinh thiet; kep lay mau noi soi",
        aliases_en_text: "biopsy forceps; endoscopic biopsy forceps",
        functions_text: "take biopsy; grasp tissue; retrieve sample",
        category: "Endoscopy accessory",
        sub_category: "Biopsy forceps"
      }
    ],
    hints,
    5
  );

  assert.equal(candidates[0].payload.device_id, "DEV042");
});

test("findLexicalCandidates ranks biopsy forceps first for pathology sample requests in the full dataset", async () => {
  const dataset = JSON.parse(await fs.readFile("dataset/surgical_device_dataset_v2_enriched.json", "utf-8"));
  const hints = extractHints("phau thuat noi soi can lay mau mo nho gui giai phau benh khong phai tui benh pham");
  const candidates = findLexicalCandidates(dataset, hints, 10);

  assert.equal(candidates[0].payload.device_id, "DEV042");
});
