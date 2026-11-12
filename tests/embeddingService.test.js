import assert from "node:assert/strict";
import { test } from "node:test";

import { embedTextWithConfig } from "../src/services/embeddingService.js";

test("embedTextWithConfig calls Gemini embedContent and returns vector values", async () => {
  let requestUrl;
  let requestBody;

  const vector = await embedTextWithConfig(
    "dao siêu âm",
    {
      embeddingProvider: "gemini",
      geminiApiKey: "test-gemini-key",
      geminiBaseUrl: "https://generativelanguage.googleapis.com/v1beta",
      embeddingModel: "gemini-embedding-001",
      geminiOutputDimensionality: 768
    },
    {
      fetchImpl: async (url, options) => {
        requestUrl = url;
        requestBody = JSON.parse(options.body);

        return {
          ok: true,
          json: async () => ({
            embedding: {
              values: [0.1, 0.2, 0.3]
            }
          })
        };
      }
    }
  );

  assert.deepEqual(vector, [0.1, 0.2, 0.3]);
  assert.equal(
    requestUrl,
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent"
  );
  assert.deepEqual(requestBody, {
    model: "models/gemini-embedding-001",
    content: {
      parts: [{ text: "dao siêu âm" }]
    },
    output_dimensionality: 768
  });
});

test("embedTextWithConfig rejects Gemini provider without API key", async () => {
  await assert.rejects(
    () =>
      embedTextWithConfig(
        "dao siêu âm",
        {
          embeddingProvider: "gemini",
          geminiApiKey: "",
          embeddingModel: "gemini-embedding-001"
        },
        { fetchImpl: async () => ({ ok: true }) }
      ),
    /GEMINI_API_KEY is missing/
  );
});
