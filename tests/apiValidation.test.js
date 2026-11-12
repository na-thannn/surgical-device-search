import assert from "node:assert/strict";
import { test } from "node:test";

import { createApp } from "../src/app.js";

async function request(app, path, options = {}) {
  const server = app.listen(0);

  try {
    const { port } = server.address();
    const response = await fetch(`http://127.0.0.1:${port}${path}`, options);
    const body = await response.json();
    return { response, body };
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}

test("GET /health returns ok", async () => {
  const app = createApp();
  const { response, body } = await request(app, "/health");

  assert.equal(response.status, 200);
  assert.deepEqual(body, { ok: true });
});

test("POST /api/search rejects empty text before embedding", async () => {
  const app = createApp({
    embedText: async () => {
      throw new Error("embedText should not be called for empty text");
    },
    searchPoints: async () => [],
    datasetProvider: async () => []
  });

  const { response, body } = await request(app, "/api/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: "   " })
  });

  assert.equal(response.status, 400);
  assert.equal(body.error, "Missing text");
});

test("POST /api/search clamps limit and returns reranked results", async () => {
  const app = createApp({
    embedText: async () => [1, 2, 3],
    searchPoints: async (vector, topK) => {
      assert.deepEqual(vector, [1, 2, 3]);
      assert.equal(topK, 20);
      return [
        {
          score: 0.8,
          payload: {
            device_id: "DEV001",
            official_name: "HARMONIC ACE+7",
            manufacturer_or_owner: "Ethicon / Johnson & Johnson",
            brand_terms_text: "HARMONIC; J&J",
            category: "Energy / Ultrasonic",
            sub_category: "Ultrasonic scalpel",
            aliases_vi_text: "dao siêu âm; dao J&J",
            functions_text: "cut; seal vessel"
          }
        }
      ];
    },
    datasetProvider: async () => []
  });

  const { response, body } = await request(app, "/api/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: "dao siêu âm J&J", limit: 999 })
  });

  assert.equal(response.status, 200);
  assert.equal(body.results.length, 1);
  assert.equal(body.results[0].device_id, "DEV001");
  assert.equal(body.debug.search_top_k, 20);
});

test("POST /api/search embeds the negation-cleaned query text", async () => {
  let embeddedText;
  const app = createApp({
    embedText: async text => {
      embeddedText = text;
      return [1, 2, 3];
    },
    searchPoints: async () => [],
    datasetProvider: async () => []
  });

  const { response } = await request(app, "/api/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: "cai tui lay benh pham noi soi khong phai endoscopic" })
  });

  assert.equal(response.status, 200);
  assert.equal(embeddedText, "cai tui lay benh pham");
});

test("POST /api/search merges lexical dataset candidates with vector candidates", async () => {
  const app = createApp({
    embedText: async () => [1, 2, 3],
    searchPoints: async () => [
      {
        score: 0.9,
        payload: {
          device_id: "DEV017",
          official_name: "Endoscopic retrieval bag",
          aliases_vi_text: "tui lay benh pham; tui endo",
          functions_text: "retrieve specimen",
          category: "Specimen retrieval"
        }
      }
    ],
    datasetProvider: async () => [
      {
        device_id: "DEV042",
        official_name: "Endoscopic biopsy forceps",
        aliases_vi_text: "kim sinh thiet; forceps sinh thiet; kep lay mau noi soi",
        aliases_en_text: "biopsy forceps",
        functions_text: "take biopsy; grasp tissue; retrieve sample",
        category: "Endoscopy accessory",
        sub_category: "Biopsy forceps"
      }
    ]
  });

  const { response, body } = await request(app, "/api/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: "kim sinh thiet noi soi tieu hoa", limit: 1 })
  });

  assert.equal(response.status, 200);
  assert.equal(body.results[0].device_id, "DEV042");
  assert.equal(body.debug.lexical_candidate_count, 1);
});

test("POST /api/search searches each device intent for multi-device requests", async () => {
  const embeddedTexts = [];
  const app = createApp({
    embedText: async text => {
      embeddedTexts.push(text);
      return [text];
    },
    searchPoints: async vector => {
      const text = vector[0];
      if (text.includes("dao sieu am")) {
        return [
          {
            score: 0.9,
            payload: {
              device_id: "DEV001",
              official_name: "HARMONIC ACE+7",
              brand_terms_text: "HARMONIC; J&J",
              category: "Energy / Ultrasonic",
              aliases_vi_text: "dao sieu am",
              functions_text: "cut; coagulate"
            }
          }
        ];
      }

      return [
        {
          score: 0.88,
          payload: {
            device_id: "DEV017",
            official_name: "Endoscopic retrieval bag",
            category: "Specimen retrieval",
            aliases_vi_text: "tui benh pham; tui lay benh pham",
            functions_text: "retrieve specimen"
          }
        }
      ];
    },
    datasetProvider: async () => []
  });

  const { response, body } = await request(app, "/api/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: "lay dao sieu am va tui benh pham", limit: 1 })
  });

  assert.equal(response.status, 200);
  assert.equal(body.intent.mode, "multi");
  assert.deepEqual(embeddedTexts, ["lay dao sieu am", "tui benh pham"]);
  assert.equal(body.intent_groups.length, 2);
  assert.equal(body.intent_groups[0].results[0].device_id, "DEV001");
  assert.equal(body.intent_groups[1].results[0].device_id, "DEV017");
  assert.deepEqual(
    body.results.map(result => result.device_id),
    ["DEV001", "DEV017"]
  );
});

test("POST /api/search marks alternative requests as ambiguous groups", async () => {
  const app = createApp({
    embedText: async text => [text],
    searchPoints: async vector => {
      const text = vector[0];
      if (text.includes("babcock")) {
        return [
          {
            score: 0.9,
            payload: {
              device_id: "DEV021",
              official_name: "Laparoscopic Babcock grasper",
              brand_terms_text: "Babcock",
              category: "Laparoscopic hand instrument",
              sub_category: "Babcock grasper",
              aliases_vi_text: "babcock noi soi; kep babcock",
              functions_text: "grasp; hold delicate tissue"
            }
          }
        ];
      }

      return [
        {
          score: 0.87,
          payload: {
            device_id: "DEV020",
            official_name: "Laparoscopic atraumatic grasper",
            category: "Laparoscopic hand instrument",
            sub_category: "Atraumatic grasper",
            aliases_vi_text: "kep gap noi soi; grasper thuong",
            functions_text: "grasp; hold tissue"
          }
        }
      ];
    },
    datasetProvider: async () => []
  });

  const { response, body } = await request(app, "/api/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: "babcock hoac grasper thuong cung duoc", limit: 1 })
  });

  assert.equal(response.status, 200);
  assert.equal(body.intent.mode, "ambiguous");
  assert.equal(body.intent.is_ambiguous, true);
  assert.equal(body.intent_groups.length, 2);
  assert.ok(body.intent_groups.every(group => group.relationship === "alternative"));
  assert.deepEqual(
    body.results.map(result => result.device_id),
    ["DEV021", "DEV020"]
  );
});

test("POST /api/search uses the latest positive request after correction", async () => {
  const embeddedTexts = [];
  const app = createApp({
    embedText: async text => {
      embeddedTexts.push(text);
      return [text];
    },
    searchPoints: async vector => {
      const text = vector[0];
      assert.equal(text, "lay grasper thuong");
      return [
        {
          score: 0.9,
          payload: {
            device_id: "DEV020",
            official_name: "Laparoscopic atraumatic grasper",
            category: "Laparoscopic hand instrument",
            sub_category: "Atraumatic grasper",
            aliases_vi_text: "kep gap noi soi; grasper thuong",
            functions_text: "grasp; hold tissue"
          }
        }
      ];
    },
    datasetProvider: async () => []
  });

  const { response, body } = await request(app, "/api/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: "lay Babcock a khong lay grasper thuong", limit: 1 })
  });

  assert.equal(response.status, 200);
  assert.deepEqual(embeddedTexts, ["lay grasper thuong"]);
  assert.equal(body.intent.was_corrected, true);
  assert.equal(body.results[0].device_id, "DEV020");
});

test("GET /api/devices/:deviceId returns dataset record or 404", async () => {
  const app = createApp({
    datasetProvider: async () => [{ device_id: "DEV001", official_name: "HARMONIC ACE+7" }]
  });

  const found = await request(app, "/api/devices/DEV001");
  assert.equal(found.response.status, 200);
  assert.equal(found.body.official_name, "HARMONIC ACE+7");

  const missing = await request(app, "/api/devices/MISSING");
  assert.equal(missing.response.status, 404);
  assert.equal(missing.body.error, "Device not found");
});

test("POST /api/feedback preserves grouped search snapshots", async () => {
  let savedPayload;
  const app = createApp({
    saveFeedback: async payload => {
      savedPayload = payload;
      return payload;
    }
  });
  const snapshot = {
    intent: { mode: "multi" },
    results: [{ device_id: "DEV001" }],
    intent_groups: [{ id: "required-1", results: [{ device_id: "DEV001" }] }]
  };

  const { response, body } = await request(app, "/api/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: "lay dao sieu am va tui benh pham",
      selected_device_id: "DEV001",
      results_snapshot: snapshot
    })
  });

  assert.equal(response.status, 200);
  assert.deepEqual(savedPayload.results_snapshot, snapshot);
  assert.deepEqual(body.feedback.results_snapshot, snapshot);
});
