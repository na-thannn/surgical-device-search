import { config } from "../config.js";

function headers() {
  const baseHeaders = {
    "Content-Type": "application/json"
  };

  if (config.qdrantApiKey) {
    baseHeaders["api-key"] = config.qdrantApiKey;
  }

  return baseHeaders;
}

async function qdrantRequest(path, options = {}) {
  const response = await fetch(`${config.qdrantUrl}${path}`, {
    method: options.method || "GET",
    headers: headers(),
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(`Qdrant error ${response.status}: ${JSON.stringify(data)}`);
  }

  return data;
}

export async function getCollection() {
  return qdrantRequest(`/collections/${config.qdrantCollection}`);
}

export async function deleteCollectionIfExists() {
  const response = await fetch(`${config.qdrantUrl}/collections/${config.qdrantCollection}`, {
    method: "DELETE",
    headers: headers()
  });

  if (![200, 202, 404].includes(response.status)) {
    const data = await response.json().catch(() => ({}));
    throw new Error(`Failed to delete Qdrant collection: ${response.status} ${JSON.stringify(data)}`);
  }
}

export async function createCollection(vectorSize) {
  return qdrantRequest(`/collections/${config.qdrantCollection}`, {
    method: "PUT",
    body: {
      vectors: {
        size: vectorSize,
        distance: config.qdrantDistance
      }
    }
  });
}

export async function recreateCollection(vectorSize) {
  await deleteCollectionIfExists();
  await createCollection(vectorSize);
}

export async function upsertPoints(points) {
  return qdrantRequest(`/collections/${config.qdrantCollection}/points?wait=true`, {
    method: "PUT",
    body: {
      points
    }
  });
}

export async function searchPoints(vector, limit = 20) {
  try {
    const queryResult = await qdrantRequest(`/collections/${config.qdrantCollection}/points/query`, {
      method: "POST",
      body: {
        query: vector,
        limit,
        with_payload: true
      }
    });

    return normalizeQdrantResults(queryResult);
  } catch {
    const searchResult = await qdrantRequest(`/collections/${config.qdrantCollection}/points/search`, {
      method: "POST",
      body: {
        vector,
        limit,
        with_payload: true
      }
    });

    return normalizeQdrantResults(searchResult);
  }
}

function normalizeQdrantResults(raw) {
  if (Array.isArray(raw.result)) {
    return raw.result;
  }

  if (Array.isArray(raw.result?.points)) {
    return raw.result.points;
  }

  return [];
}
