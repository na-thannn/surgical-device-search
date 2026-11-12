import { normalizeText, splitSemiColonText } from "./textProcessing.js";

const STOPWORDS = new Set([
  "cai",
  "lay",
  "cho",
  "can",
  "xin",
  "giup",
  "dung",
  "de",
  "trong",
  "mot",
  "va",
  "vua",
  "the",
  "a",
  "an",
  "phau",
  "thuat",
  "noi",
  "soi",
  "nho",
  "gui",
  "o",
  "mo",
  "bac",
  "si",
  "dieu",
  "duong"
]);

function meaningfulTokens(text) {
  return normalizeText(text)
    .split(" ")
    .map(token => token.trim())
    .filter(token => token.length >= 2 && !STOPWORDS.has(token));
}

function payloadText(record) {
  return [
    record.official_name,
    record.manufacturer_or_owner,
    record.brand_terms_text,
    record.category,
    record.sub_category,
    record.aliases_vi_text,
    record.aliases_en_text,
    record.functions_text,
    record.departments_text,
    record.example_queries_text,
    record.embedding_text_vi,
    record.notes
  ].join("; ");
}

function anyTermMatch(queryNorm, text) {
  return splitSemiColonText(text).some(term => {
    const normalizedTerm = normalizeText(term);
    return normalizedTerm && (queryNorm.includes(normalizedTerm) || normalizedTerm.includes(queryNorm));
  });
}

function countHintMatches(hints, text) {
  const textNorm = normalizeText(text);
  let count = 0;

  for (const hint of hints) {
    const hintNorm = normalizeText(hint);
    if (hintNorm && textNorm.includes(hintNorm)) {
      count += 1;
    }
  }

  return count;
}

function tokenOverlapScore(tokens, haystackNorm) {
  if (!tokens.length) {
    return 0;
  }

  const matches = tokens.filter(token => haystackNorm.includes(token)).length;
  return matches / tokens.length;
}

function scoreRecord(record, hints) {
  const queryNorm = hints.embedding_query || hints.normalized_query;
  const haystack = payloadText(record);
  const haystackNorm = normalizeText(haystack);
  const tokens = meaningfulTokens(queryNorm);
  let score = 0;

  if (anyTermMatch(queryNorm, record.aliases_vi_text)) score += 0.32;
  if (anyTermMatch(queryNorm, record.aliases_en_text)) score += 0.2;
  if (normalizeText(record.official_name).includes(queryNorm)) score += 0.22;

  score += Math.min(tokenOverlapScore(tokens, haystackNorm) * 0.34, 0.34);
  score += Math.min(countHintMatches(hints.brands || [], haystack) * 0.08, 0.16);
  score += Math.min(countHintMatches(hints.functions || [], haystack) * 0.16, 0.32);
  score += Math.min(countHintMatches(hints.categories || [], haystack) * 0.05, 0.15);
  score -= Math.min(countHintMatches(hints.negated_terms || [], haystack) * 0.35, 0.7);

  return score;
}

export function findLexicalCandidates(dataset, hints, limit = 12) {
  if (!Array.isArray(dataset) || dataset.length === 0) {
    return [];
  }

  return dataset
    .map(record => {
      const lexicalScore = scoreRecord(record, hints);
      return {
        score: Number(Math.min(0.95, 0.55 + lexicalScore).toFixed(4)),
        payload: record,
        source: "lexical",
        lexical_score: Number(lexicalScore.toFixed(4))
      };
    })
    .filter(candidate => candidate.lexical_score > 0.12)
    .sort((a, b) => b.lexical_score - a.lexical_score)
    .slice(0, limit);
}
