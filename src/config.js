import "dotenv/config";

function numberFromEnv(name, fallback) {
  const value = process.env[name];
  if (value === undefined || value === "") {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function booleanFromEnv(name, fallback) {
  const value = process.env[name];
  if (value === undefined || value === "") {
    return fallback;
  }

  return String(value).toLowerCase() === "true";
}

export const config = {
  port: numberFromEnv("PORT", 3000),
  nodeEnv: process.env.NODE_ENV || "development",

  datasetPath: process.env.DATASET_PATH || "dataset/surgical_device_dataset_v2_enriched.json",
  embeddingCachePath: process.env.EMBEDDING_CACHE_PATH || "storage/embedding_cache.json",
  feedbackLogPath: process.env.FEEDBACK_LOG_PATH || "storage/feedback_log.jsonl",

  embeddingProvider: process.env.EMBEDDING_PROVIDER || "openai",
  openaiApiKey: process.env.OPENAI_API_KEY || "",
  openaiBaseUrl: process.env.OPENAI_BASE_URL || undefined,
  embeddingModel: process.env.EMBEDDING_MODEL || "text-embedding-3-small",
  embeddingDim: numberFromEnv("EMBEDDING_DIM", null),
  geminiApiKey: process.env.GEMINI_API_KEY || "",
  geminiBaseUrl: process.env.GEMINI_BASE_URL || "https://generativelanguage.googleapis.com/v1beta",
  geminiOutputDimensionality: numberFromEnv("GEMINI_OUTPUT_DIMENSIONALITY", null),
  geminiTaskType: process.env.GEMINI_TASK_TYPE || "",

  qdrantUrl: process.env.QDRANT_URL || "http://localhost:6333",
  qdrantApiKey: process.env.QDRANT_API_KEY || "",
  qdrantCollection: process.env.QDRANT_COLLECTION || "surgical_devices_v1",
  qdrantDistance: process.env.QDRANT_DISTANCE || "Cosine",

  searchTopK: numberFromEnv("SEARCH_TOP_K", 20),
  returnLimit: numberFromEnv("RETURN_LIMIT", 3),
  showDebug: booleanFromEnv("SHOW_DEBUG", true)
};
