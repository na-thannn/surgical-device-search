import { config } from "../config.js";

let openaiClient;

async function getOpenAiClient(runtimeConfig) {
  if (!openaiClient) {
    if (!runtimeConfig.openaiApiKey) {
      throw new Error("OPENAI_API_KEY is missing. Add it to your .env file.");
    }

    const { default: OpenAI } = await import("openai");
    openaiClient = new OpenAI({
      apiKey: runtimeConfig.openaiApiKey,
      baseURL: runtimeConfig.openaiBaseUrl
    });
  }

  return openaiClient;
}

export async function embedText(text) {
  return embedTextWithConfig(text, config);
}

export async function embedTextWithConfig(text, runtimeConfig, dependencies = {}) {
  if (!text || !String(text).trim()) {
    throw new Error("Cannot embed empty text.");
  }

  const provider = String(runtimeConfig.embeddingProvider || "openai").toLowerCase();

  if (provider === "gemini") {
    return embedWithGemini(text, runtimeConfig, dependencies);
  }

  if (provider === "openai" || provider === "openai_compatible") {
    return embedWithOpenAi(text, runtimeConfig, dependencies);
  }

  throw new Error(`Unsupported EMBEDDING_PROVIDER: ${runtimeConfig.embeddingProvider}`);
}

async function embedWithOpenAi(text, runtimeConfig, dependencies = {}) {
  const client = dependencies.openaiClient || (await getOpenAiClient(runtimeConfig));
  const response = await client.embeddings.create({
    model: runtimeConfig.embeddingModel,
    input: text
  });

  const vector = response.data?.[0]?.embedding;
  return validateVector(vector, "Embedding provider returned an invalid vector.");
}

async function embedWithGemini(text, runtimeConfig, dependencies = {}) {
  if (!runtimeConfig.geminiApiKey) {
    throw new Error("GEMINI_API_KEY is missing. Add it to your .env file.");
  }

  const fetchImpl = dependencies.fetchImpl || fetch;
  const model = normalizeGeminiModelName(runtimeConfig.embeddingModel || "gemini-embedding-001");
  const baseUrl = String(runtimeConfig.geminiBaseUrl || "https://generativelanguage.googleapis.com/v1beta")
    .replace(/\/+$/, "");
  const body = {
    model: `models/${model}`,
    content: {
      parts: [{ text }]
    }
  };

  if (runtimeConfig.geminiOutputDimensionality) {
    body.output_dimensionality = runtimeConfig.geminiOutputDimensionality;
  }

  if (runtimeConfig.geminiTaskType) {
    body.taskType = runtimeConfig.geminiTaskType;
  }

  const response = await fetchImpl(`${baseUrl}/models/${model}:embedContent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": runtimeConfig.geminiApiKey
    },
    body: JSON.stringify(body)
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(`Gemini embedding error ${response.status}: ${JSON.stringify(data)}`);
  }

  const vector = data.embedding?.values || data.embeddings?.[0]?.values;
  return validateVector(vector, "Gemini embedding provider returned an invalid vector.");
}

function normalizeGeminiModelName(model) {
  return String(model || "gemini-embedding-001").replace(/^models\//, "");
}

function validateVector(vector, message) {
  if (!Array.isArray(vector) || vector.length === 0) {
    throw new Error(message);
  }

  return vector;
}
