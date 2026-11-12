import express from "express";

import { config } from "../config.js";
import { extractHints } from "../services/hintExtractor.js";
import { parseSearchIntent } from "../services/intentParser.js";
import { loadDataset as defaultLoadDataset } from "../services/datasetService.js";
import { findLexicalCandidates } from "../services/lexicalSearchService.js";
import { rerankCandidates } from "../services/reranker.js";

function clampLimit(value) {
  const parsed = Number(value || config.returnLimit);

  if (!Number.isFinite(parsed)) {
    return config.returnLimit;
  }

  return Math.max(1, Math.min(10, Math.trunc(parsed)));
}

export function createSearchRouter(dependencies = {}) {
  let embedText = dependencies.embedText;
  let searchPoints = dependencies.searchPoints;
  const datasetProvider = dependencies.datasetProvider || defaultLoadDataset;
  const router = express.Router();

  router.post("/search", async (req, res, next) => {
    try {
      const text = String(req.body?.text || "").trim();

      if (!text) {
        return res.status(400).json({ error: "Missing text" });
      }

      const limit = clampLimit(req.body?.limit);
      const intent = parseSearchIntent(text);
      embedText ||= (await import("../services/embeddingService.js")).embedText;
      searchPoints ||= (await import("../services/qdrantService.js")).searchPoints;
      const dataset = await datasetProvider();
      const intentGroups = [];

      for (const parsedIntent of intent.intents) {
        const hints = extractHints(parsedIntent.text);
        const vector = await embedText(hints.embedding_query || parsedIntent.text);
        const candidates = await searchPoints(vector, config.searchTopK);
        const lexicalCandidates = findLexicalCandidates(dataset, hints);
        const results = rerankCandidates([...candidates, ...lexicalCandidates], hints, limit);

        intentGroups.push({
          id: parsedIntent.id,
          label: parsedIntent.label,
          relationship: parsedIntent.relationship,
          query: parsedIntent.text,
          hints,
          results,
          debug: {
            candidate_count: candidates.length,
            lexical_candidate_count: lexicalCandidates.length
          }
        });
      }

      const isGrouped = intent.mode !== "single" || intentGroups.length > 1;
      const results = isGrouped
        ? intentGroups.flatMap(group => group.results.slice(0, 1))
        : intentGroups[0]?.results || [];
      const hints = isGrouped ? extractHints(intent.effective_query) : intentGroups[0]?.hints || extractHints(text);

      return res.json({
        query: text,
        intent,
        hints,
        results,
        intent_groups: isGrouped ? intentGroups : undefined,
        debug: config.showDebug
          ? {
              candidate_count: intentGroups.reduce((sum, group) => sum + group.debug.candidate_count, 0),
              lexical_candidate_count: intentGroups.reduce((sum, group) => sum + group.debug.lexical_candidate_count, 0),
              group_count: intentGroups.length,
              search_top_k: config.searchTopK
            }
          : undefined
      });
    } catch (error) {
      return next(error);
    }
  });

  return router;
}
