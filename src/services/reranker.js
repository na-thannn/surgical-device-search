import { normalizeText, splitSemiColonText } from "./textProcessing.js";

const MODALITY_HINTS = new Set(["laparoscopic", "endoscopy", "robotic", "atraumatic grasper"]);

function textMatchesAny(queryNorm, values) {
  for (const value of values) {
    const normalizedValue = normalizeText(value);
    if (normalizedValue && queryNorm.includes(normalizedValue)) {
      return true;
    }
  }

  return false;
}

function countPayloadMatches(hints, payloadText) {
  const payloadNorm = normalizeText(payloadText || "");
  let count = 0;

  for (const hint of hints) {
    const normalizedHint = normalizeText(hint);
    if (normalizedHint && payloadNorm.includes(normalizedHint)) {
      count += 1;
    }
  }

  return count;
}

function buildReason({
  officialNameMatched,
  aliasMatched,
  brandMatches,
  functionMatches,
  categoryMatches,
  negatedMatches,
  correctedMatches,
  modalityMismatch
}) {
  const reasons = [];

  if (officialNameMatched) reasons.push("official name matched the query");
  if (aliasMatched) reasons.push("Vietnamese alias matched the query");
  if (brandMatches > 0) reasons.push("brand/manufacturer matched");
  if (functionMatches > 0) reasons.push(`${functionMatches} function hint(s) matched`);
  if (categoryMatches > 0) reasons.push(`${categoryMatches} category hint(s) matched`);
  if (correctedMatches > 0) reasons.push("later correction matched this result");
  if (negatedMatches > 0) reasons.push("negated query term matched this result");
  if (modalityMismatch) reasons.push("did not match the requested surgical approach/context");

  if (reasons.length === 0) {
    reasons.push("semantic vector similarity match");
  }

  return reasons;
}

export function rerankCandidates(points, hints, returnLimit = 3) {
  const queryNorm = hints.normalized_query;
  const positiveQueryNorm = hints.embedding_query || hints.normalized_query;
  const byDevice = new Map();

  for (const point of points) {
    const payload = point.payload || {};
    const deviceId = payload.device_id;
    if (!deviceId) continue;

    const vectorScore = Number(point.score || 0);
    const officialNameMatched = textMatchesAny(positiveQueryNorm, [payload.official_name]);
    const aliasMatched = textMatchesAny(positiveQueryNorm, splitSemiColonText(payload.aliases_vi_text));

    const brandMatches = countPayloadMatches(
      hints.brands,
      [payload.brand_terms_text, payload.manufacturer_or_owner, payload.official_name].join("; ")
    );
    const functionMatches = countPayloadMatches(hints.functions, payload.functions_text);
    const categoryMatches = countPayloadMatches(
      hints.categories,
      [payload.category, payload.sub_category, payload.embedding_text_vi].join("; ")
    );
    const modalityHints = (hints.categories || []).filter(hint => MODALITY_HINTS.has(hint));
    const modalityMatches = countPayloadMatches(
      modalityHints,
      [payload.category, payload.sub_category, payload.aliases_en_text, payload.departments_text, payload.embedding_text_vi].join("; ")
    );
    const shouldRequireModality = modalityHints.includes("robotic") || modalityHints.length > 1;
    const modalityMismatch = shouldRequireModality && modalityMatches === 0;
    const negatedMatches = countPayloadMatches(
      hints.negated_terms || [],
      [
        payload.official_name,
        payload.manufacturer_or_owner,
        payload.brand_terms_text,
        payload.category,
        payload.sub_category,
        payload.aliases_vi_text,
        payload.aliases_en_text,
        payload.functions_text,
        payload.departments_text,
        payload.embedding_text_vi,
        payload.notes
      ].join("; ")
    );
    const correctedMatches = countPayloadMatches(
      hints.corrected_terms || [],
      [
        payload.official_name,
        payload.manufacturer_or_owner,
        payload.brand_terms_text,
        payload.category,
        payload.sub_category,
        payload.aliases_vi_text,
        payload.aliases_en_text,
        payload.functions_text,
        payload.departments_text,
        payload.embedding_text_vi,
        payload.notes
      ].join("; ")
    );

    let finalScore = vectorScore;
    if (officialNameMatched) finalScore += 0.15;
    if (aliasMatched) finalScore += 0.12;
    if (brandMatches > 0) finalScore += 0.1;
    finalScore += Math.min(functionMatches * 0.12, 0.36);
    finalScore += Math.min(categoryMatches * 0.035, 0.1);
    finalScore += Math.min(correctedMatches * 0.3, 0.45);
    if (modalityMismatch) finalScore -= 0.16;
    finalScore -= Math.min(negatedMatches * 0.45, 0.9);

    const result = {
      device_id: deviceId,
      official_name: payload.official_name,
      record_type: payload.record_type,
      manufacturer_or_owner: payload.manufacturer_or_owner,
      brand_terms_text: payload.brand_terms_text,
      category: payload.category,
      sub_category: payload.sub_category,
      aliases_vi_text: payload.aliases_vi_text,
      aliases_en_text: payload.aliases_en_text,
      functions_text: payload.functions_text,
      departments_text: payload.departments_text,
      notes: payload.notes,
      vector_score: Number(vectorScore.toFixed(4)),
      final_score: Number(finalScore.toFixed(4)),
      reason: buildReason({
        officialNameMatched,
        aliasMatched,
        brandMatches,
        functionMatches,
        categoryMatches,
        negatedMatches,
        correctedMatches,
        modalityMismatch
      })
    };

    const existing = byDevice.get(deviceId);
    if (!existing || result.final_score > existing.final_score) {
      byDevice.set(deviceId, result);
    }
  }

  return Array.from(byDevice.values())
    .sort((a, b) => b.final_score - a.final_score)
    .slice(0, returnLimit);
}
