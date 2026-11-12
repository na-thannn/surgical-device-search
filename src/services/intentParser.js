import { normalizeText } from "./textProcessing.js";

const CORRECTION_MARKERS = [
  "a khong",
  "ah khong",
  "a thoi",
  "ah thoi",
  "doi lai",
  "lay lai",
  "chon lai",
  "actually",
  "instead",
  "change to"
];

const ALTERNATIVE_SPLIT_RE = /\b(?:hoac la|hoac|or|either)\b/;
const MULTI_SPLIT_RE = /\b(?:va|and|plus)\b/;

const TRAILING_NOISE = [
  "cung duoc",
  "deu duoc",
  "neu co",
  "cai nao cung duoc"
];

function stripNoise(text) {
  let cleaned = ` ${text} `;

  for (const phrase of TRAILING_NOISE) {
    cleaned = cleaned.replaceAll(` ${normalizeText(phrase)} `, " ");
  }

  return cleaned.replace(/\s+/g, " ").trim();
}

function meaningfulSegments(text, splitter) {
  return text
    .split(splitter)
    .map(segment => stripNoise(segment))
    .filter(segment => segment.length > 0);
}

function latestCorrection(normalizedInput) {
  let best = null;

  for (const marker of CORRECTION_MARKERS) {
    const normalizedMarker = normalizeText(marker);
    const index = normalizedInput.lastIndexOf(normalizedMarker);

    if (index < 0) continue;

    const startsAt = index + normalizedMarker.length;
    const text = stripNoise(normalizedInput.slice(startsAt));
    if (!text) continue;

    if (!best || index > best.index) {
      best = { index, marker: normalizedMarker, text };
    }
  }

  return best;
}

function buildIntents(segments, relationship) {
  return segments.map((segment, index) => ({
    id: `${relationship}-${index + 1}`,
    label: relationship === "alternative" ? `Option ${index + 1}` : `Device ${index + 1}`,
    relationship,
    text: segment
  }));
}

export function parseSearchIntent(inputText) {
  const normalizedQuery = normalizeText(inputText);
  const correction = latestCorrection(normalizedQuery);
  const effectiveQuery = correction?.text || normalizedQuery;

  const alternativeSegments = meaningfulSegments(effectiveQuery, ALTERNATIVE_SPLIT_RE);
  if (alternativeSegments.length > 1) {
    return {
      mode: "ambiguous",
      normalized_query: normalizedQuery,
      effective_query: effectiveQuery,
      is_multi_intent: false,
      is_ambiguous: true,
      was_corrected: Boolean(correction),
      correction_marker: correction?.marker,
      intents: buildIntents(alternativeSegments, "alternative")
    };
  }

  const multiSegments = meaningfulSegments(effectiveQuery, MULTI_SPLIT_RE);
  if (multiSegments.length > 1) {
    return {
      mode: "multi",
      normalized_query: normalizedQuery,
      effective_query: effectiveQuery,
      is_multi_intent: true,
      is_ambiguous: false,
      was_corrected: Boolean(correction),
      correction_marker: correction?.marker,
      intents: buildIntents(multiSegments, "required")
    };
  }

  return {
    mode: "single",
    normalized_query: normalizedQuery,
    effective_query: effectiveQuery,
    is_multi_intent: false,
    is_ambiguous: false,
    was_corrected: Boolean(correction),
    correction_marker: correction?.marker,
    intents: buildIntents([effectiveQuery], correction ? "correction" : "primary")
  };
}
