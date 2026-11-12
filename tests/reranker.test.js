import assert from "node:assert/strict";
import { test } from "node:test";

import { extractHints } from "../src/services/hintExtractor.js";
import { rerankCandidates } from "../src/services/reranker.js";

function point(score, payload) {
  return { score, payload };
}

test("rerankCandidates boosts exact alias, brand, function, and category matches", () => {
  const hints = extractHints("lấy dao siêu âm J&J vừa cắt vừa hàn mạch");
  const results = rerankCandidates(
    [
      point(0.9, {
        device_id: "DEV004",
        official_name: "SonoSurg",
        manufacturer_or_owner: "Olympus",
        brand_terms_text: "SonoSurg; Olympus",
        category: "Energy / Ultrasonic",
        sub_category: "Ultrasonic surgical system",
        aliases_vi_text: "dao siêu âm olympus",
        functions_text: "cut; coagulate",
        departments_text: "laparoscopy"
      }),
      point(0.82, {
        device_id: "DEV001",
        official_name: "HARMONIC ACE+7",
        manufacturer_or_owner: "Ethicon / Johnson & Johnson",
        brand_terms_text: "HARMONIC; J&J; Ethicon; Johnson & Johnson",
        category: "Energy / Ultrasonic",
        sub_category: "Ultrasonic scalpel",
        aliases_vi_text: "dao siêu âm; dao harmonic; dao J&J; cây harmonic; cây cắt hàn mạch",
        functions_text: "cut; coagulate; seal vessel; dissect tissue",
        departments_text: "general surgery; laparoscopy"
      })
    ],
    hints,
    1
  );

  assert.equal(results.length, 1);
  assert.equal(results[0].device_id, "DEV001");
  assert.ok(results[0].final_score > results[0].vector_score);
  assert.ok(results[0].reason.includes("Vietnamese alias matched the query"));
  assert.ok(results[0].reason.includes("brand/manufacturer matched"));
});

test("rerankCandidates aggregates duplicate Qdrant points by device_id", () => {
  const hints = extractHints("lấy cây hút rửa");
  const results = rerankCandidates(
    [
      point(0.6, {
        device_id: "DEV025",
        official_name: "Suction irrigation cannula",
        brand_terms_text: "suction; irrigation",
        category: "Laparoscopic suction / irrigation",
        sub_category: "Suction irrigation instrument",
        aliases_vi_text: "ống hút rửa nội soi; cây hút rửa",
        functions_text: "suction; irrigate; clear fluid"
      }),
      point(0.92, {
        device_id: "DEV025",
        official_name: "Suction irrigation cannula",
        brand_terms_text: "suction; irrigation",
        category: "Laparoscopic suction / irrigation",
        sub_category: "Suction irrigation instrument",
        aliases_vi_text: "ống hút rửa nội soi; cây hút rửa",
        functions_text: "suction; irrigation; irrigate; clear fluid"
      })
    ],
    hints,
    3
  );

  assert.equal(results.length, 1);
  assert.equal(results[0].device_id, "DEV025");
  assert.equal(results[0].vector_score, 0.92);
});

test("rerankCandidates penalizes candidates that contain a negated query term", () => {
  const hints = extractHints("cai tui lay benh pham noi soi khong phai endoscopic");
  const results = rerankCandidates(
    [
      point(0.95, {
        device_id: "DEV017",
        official_name: "Endoscopic retrieval bag",
        category: "Specimen retrieval",
        sub_category: "Endoscopic bag",
        aliases_vi_text: "tui lay benh pham; tui endo",
        aliases_en_text: "endoscopic retrieval bag; specimen bag",
        functions_text: "retrieve specimen; contain tissue"
      }),
      point(0.75, {
        device_id: "DEV999",
        official_name: "Specimen pouch",
        category: "Specimen retrieval",
        sub_category: "Specimen bag",
        aliases_vi_text: "tui lay benh pham; tui dung benh pham",
        aliases_en_text: "specimen bag",
        functions_text: "retrieve specimen; contain tissue"
      })
    ],
    hints,
    2
  );

  assert.equal(results[0].device_id, "DEV999");
  assert.ok(results[1].reason.includes("negated query term matched this result"));
});

test("rerankCandidates penalizes Yankauer when the query asks for suction irrigation but not Yankauer", () => {
  const hints = extractHints("dung cu vua bom rua vua hut dich trong o bung khong phai dau hut yankauer");
  const results = rerankCandidates(
    [
      point(0.95, {
        device_id: "DEV052",
        official_name: "Yankauer suction tip",
        category: "Suction",
        sub_category: "Rigid suction tip",
        aliases_vi_text: "dau hut yankauer; ong hut phau thuat",
        aliases_en_text: "Yankauer suction tip; rigid suction tip",
        functions_text: "suction; clear blood; clear fluid"
      }),
      point(0.82, {
        device_id: "DEV025",
        official_name: "Suction irrigation cannula",
        category: "Laparoscopic suction / irrigation",
        sub_category: "Suction irrigation instrument",
        aliases_vi_text: "ong hut rua noi soi; cay hut rua; suction irrigation",
        aliases_en_text: "suction irrigation cannula; laparoscopic suction irrigator",
        functions_text: "suction; irrigate; irrigation; clear fluid"
      })
    ],
    hints,
    2
  );

  assert.equal(results[0].device_id, "DEV025");
  assert.ok(results[1].reason.includes("negated query term matched this result"));
});

test("rerankCandidates prefers a specific function match over a broad category match", () => {
  const hints = extractHints("phau thuat noi soi can lay mau mo nho gui giai phau benh khong phai tui benh pham");
  const results = rerankCandidates(
    [
      point(0.87, {
        device_id: "DEV022",
        official_name: "Laparoscopic scissors",
        category: "Laparoscopic hand instrument",
        sub_category: "Scissors",
        aliases_vi_text: "keo noi soi",
        functions_text: "cut; dissect tissue"
      }),
      point(0.86, {
        device_id: "DEV042",
        official_name: "Endoscopic biopsy forceps",
        category: "Endoscopy accessory",
        sub_category: "Biopsy forceps",
        aliases_vi_text: "kim sinh thiet; kep lay mau noi soi",
        aliases_en_text: "biopsy forceps",
        functions_text: "take biopsy; grasp tissue; retrieve sample"
      })
    ],
    hints,
    2
  );

  assert.equal(results[0].device_id, "DEV042");
});

test("rerankCandidates prefers robotic suction when standard laparoscopic suction irrigation is negated", () => {
  const hints = extractHints(
    "trong ca robot can dung cu hut rua de lam sach truong mo khong phai cay hut rua noi soi thuong"
  );
  const results = rerankCandidates(
    [
      point(0.94, {
        device_id: "DEV025",
        official_name: "Suction irrigation cannula",
        category: "Laparoscopic suction / irrigation",
        sub_category: "Suction irrigation instrument",
        aliases_vi_text: "ong hut rua noi soi; cay hut rua",
        aliases_en_text: "suction irrigation cannula; laparoscopic suction irrigator",
        functions_text: "suction; irrigate; irrigation; clear fluid",
        departments_text: "laparoscopy"
      }),
      point(0.82, {
        device_id: "DEV091",
        official_name: "Robotic suction irrigator",
        category: "Robotic surgery instrument",
        sub_category: "Suction irrigator",
        aliases_vi_text: "hut rua robot; ong hut rua robot; tay robot hut rua",
        aliases_en_text: "robotic suction irrigator; robotic suction tool",
        functions_text: "suction fluid; irrigate field; clear blood; improve visibility",
        departments_text: "robotic surgery"
      })
    ],
    hints,
    2
  );

  assert.equal(results[0].device_id, "DEV091");
  assert.ok(results[1].reason.includes("negated query term matched this result"));
});

test("rerankCandidates prefers specimen container when endo retrieval bag is negated", () => {
  const hints = extractHints("can hop dung benh pham gui giai phau benh khong phai tui endo lay benh pham");
  const results = rerankCandidates(
    [
      point(0.95, {
        device_id: "DEV017",
        official_name: "Endoscopic retrieval bag",
        category: "Specimen retrieval",
        sub_category: "Endoscopic bag",
        aliases_vi_text: "tui lay benh pham; tui endo; tui dung benh pham",
        aliases_en_text: "endoscopic retrieval bag; specimen bag",
        functions_text: "retrieve specimen; contain tissue"
      }),
      point(0.78, {
        device_id: "DEV067",
        official_name: "Specimen container",
        category: "Specimen handling",
        sub_category: "Container",
        aliases_vi_text: "hop benh pham; lo benh pham; hop dung mau; lo formol",
        aliases_en_text: "specimen container; sample container",
        functions_text: "contain specimen; send pathology; label sample"
      })
    ],
    hints,
    2
  );

  assert.equal(results[0].device_id, "DEV067");
  assert.ok(results[1].reason.includes("negated query term matched this result"));
});

test("rerankCandidates does not boost names that only appear inside negated spans", () => {
  const hints = extractHints("can kep giu mo nhe trong noi soi khong phai babcock khong phai clip applier");
  const results = rerankCandidates(
    [
      point(0.92, {
        device_id: "DEV024",
        official_name: "Laparoscopic clip applier",
        category: "Laparoscopic hand instrument",
        sub_category: "Clip applier",
        aliases_vi_text: "cay bam clip; kep clip noi soi",
        aliases_en_text: "laparoscopic clip applier",
        functions_text: "apply clips; ligate duct"
      }),
      point(0.82, {
        device_id: "DEV020",
        official_name: "Laparoscopic atraumatic grasper",
        category: "Laparoscopic hand instrument",
        sub_category: "Atraumatic grasper",
        aliases_vi_text: "kep gap noi soi; kep khong sang chan; cay gap mo",
        aliases_en_text: "laparoscopic grasper; atraumatic grasper",
        functions_text: "grasp; hold tissue; retract tissue"
      })
    ],
    hints,
    2
  );

  assert.equal(results[0].device_id, "DEV020");
  assert.ok(results[1].reason.includes("negated query term matched this result"));
});

test("rerankCandidates prefers laparoscopic graspers over basic tissue forceps when the query says noi soi", () => {
  const hints = extractHints("can kep giu mo nhe trong noi soi khong phai babcock khong phai clip applier");
  const results = rerankCandidates(
    [
      point(0.95, {
        device_id: "DEV047",
        official_name: "Allis tissue forceps",
        category: "Basic surgical instrument",
        sub_category: "Tissue forceps",
        aliases_vi_text: "kep allis; kep mo allis; kep giu mo",
        aliases_en_text: "Allis forceps; Allis tissue forceps",
        functions_text: "grasp tissue; hold tissue"
      }),
      point(0.88, {
        device_id: "DEV020",
        official_name: "Laparoscopic atraumatic grasper",
        category: "Laparoscopic hand instrument",
        sub_category: "Atraumatic grasper",
        aliases_vi_text: "kep gap noi soi; kep khong sang chan; cay gap mo",
        aliases_en_text: "laparoscopic grasper; atraumatic grasper",
        functions_text: "grasp; hold tissue; retract tissue"
      })
    ],
    hints,
    2
  );

  assert.equal(results[0].device_id, "DEV020");
});

test("rerankCandidates lets a later correction choose Babcock after it was initially negated", () => {
  const hints = extractHints(
    "can kep giu mo nhe trong noi soi khong phai babcock khong phai clip applier a thoi lay cua babcock di"
  );
  const results = rerankCandidates(
    [
      point(0.86, {
        device_id: "DEV021",
        official_name: "Laparoscopic Babcock grasper",
        brand_terms_text: "Babcock",
        category: "Laparoscopic hand instrument",
        sub_category: "Babcock grasper",
        aliases_vi_text: "babcock noi soi; kep babcock; kep ruot noi soi; cay gap ruot",
        aliases_en_text: "laparoscopic Babcock; Babcock grasper",
        functions_text: "grasp; hold delicate tissue; retract tissue",
        departments_text: "laparoscopy"
      }),
      point(0.92, {
        device_id: "DEV020",
        official_name: "Laparoscopic atraumatic grasper",
        category: "Laparoscopic hand instrument",
        sub_category: "Atraumatic grasper",
        aliases_vi_text: "kep gap noi soi; kep khong sang chan; cay gap mo",
        aliases_en_text: "laparoscopic grasper; atraumatic grasper",
        functions_text: "grasp; hold tissue; retract tissue",
        departments_text: "laparoscopy"
      }),
      point(0.95, {
        device_id: "DEV024",
        official_name: "Laparoscopic clip applier",
        category: "Laparoscopic hand instrument",
        sub_category: "Clip applier",
        aliases_vi_text: "cay bam clip; kep clip noi soi",
        aliases_en_text: "laparoscopic clip applier",
        functions_text: "apply clips; ligate duct",
        departments_text: "laparoscopy"
      })
    ],
    hints,
    3
  );

  assert.equal(results[0].device_id, "DEV021");
  assert.ok(results.find(result => result.device_id === "DEV024").reason.includes("negated query term matched this result"));
});
