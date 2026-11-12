import fs from "node:fs/promises";
import path from "node:path";

import { config } from "../src/config.js";
import { embedText } from "../src/services/embeddingService.js";
import { recreateCollection, upsertPoints } from "../src/services/qdrantService.js";

async function readJson(filePath, fallback) {
  try {
    const raw = await fs.readFile(path.resolve(filePath), "utf-8");
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

async function writeJson(filePath, data) {
  const resolvedPath = path.resolve(filePath);
  await fs.mkdir(path.dirname(resolvedPath), { recursive: true });
  await fs.writeFile(resolvedPath, JSON.stringify(data, null, 2), "utf-8");
}

function getCacheKey(text) {
  return `${config.embeddingModel}::${text}`;
}

async function getEmbeddingWithCache(text, cache) {
  const key = getCacheKey(text);

  if (Array.isArray(cache[key])) {
    return cache[key];
  }

  const vector = await embedText(text);
  cache[key] = vector;
  await writeJson(config.embeddingCachePath, cache);
  return vector;
}

function buildPayload(record) {
  return {
    device_id: record.device_id,
    official_name: record.official_name,
    record_type: record.record_type,
    manufacturer_or_owner: record.manufacturer_or_owner,
    brand_terms_text: record.brand_terms_text,
    category: record.category,
    sub_category: record.sub_category,
    aliases_vi_text: record.aliases_vi_text,
    aliases_en_text: record.aliases_en_text,
    functions_text: record.functions_text,
    departments_text: record.departments_text,
    example_queries_text: record.example_queries_text,
    embedding_text_vi: record.embedding_text_vi,
    source_hint: record.source_hint,
    source_url: record.source_url,
    notes: record.notes
  };
}

async function main() {
  const dataset = await readJson(config.datasetPath, []);
  const cache = await readJson(config.embeddingCachePath, {});

  if (!Array.isArray(dataset) || dataset.length === 0) {
    throw new Error(`Dataset is empty or missing: ${path.resolve(config.datasetPath)}`);
  }

  console.log(`Loaded ${dataset.length} records from dataset.`);

  const points = [];
  let pointId = 1;
  let detectedVectorSize = config.embeddingDim;

  for (const record of dataset) {
    if (!record.embedding_text_vi) {
      console.warn(`Skipping ${record.device_id}: missing embedding_text_vi`);
      continue;
    }

    console.log(`Embedding ${record.device_id} - ${record.official_name}`);

    const vector = await getEmbeddingWithCache(record.embedding_text_vi, cache);

    if (!detectedVectorSize) {
      detectedVectorSize = vector.length;
    }

    points.push({
      id: pointId++,
      vector,
      payload: buildPayload(record)
    });
  }

  if (!detectedVectorSize) {
    throw new Error("Could not detect vector size.");
  }

  console.log(`Vector size: ${detectedVectorSize}`);
  console.log(`Recreating Qdrant collection: ${config.qdrantCollection}`);
  await recreateCollection(detectedVectorSize);

  const batchSize = 32;
  for (let i = 0; i < points.length; i += batchSize) {
    const batch = points.slice(i, i + batchSize);
    console.log(`Upserting batch ${i + 1} to ${i + batch.length}`);
    await upsertPoints(batch);
  }

  console.log("Seed complete.");
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
