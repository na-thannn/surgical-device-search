# Surgical Device Search Prototype

Local prototype for Use Case 1: search surgical devices from short Vietnamese text descriptions.

The app flow is:

```txt
Text input -> embedding -> Qdrant vector search -> rule-based reranker -> Top 3 device suggestions -> user confirmation
```

This is not a clinical decision system. A trained user must confirm the final device, and the dataset must be reviewed before any real operational use.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create local environment:

```bash
cp .env.example .env
```

3. Add an embedding provider to `.env`.

For OpenAI or an OpenAI-compatible provider:

```env
EMBEDDING_PROVIDER=openai
OPENAI_API_KEY=real_key_from_mentor
EMBEDDING_MODEL=text-embedding-3-small
```

If the provider is OpenAI-compatible but not OpenAI-hosted, also set:

```env
OPENAI_BASE_URL=https://provider.example.com/v1
```

For Gemini embeddings from Google AI Studio:

```env
EMBEDDING_PROVIDER=gemini
GEMINI_API_KEY=your_google_ai_studio_key
EMBEDDING_MODEL=gemini-embedding-001
GEMINI_TASK_TYPE=SEMANTIC_SIMILARITY
GEMINI_OUTPUT_DIMENSIONALITY=
```

`gemini-embedding-001` is the stable text embedding model. If your AI Studio project exposes `gemini-embedding-2`, you can set `EMBEDDING_MODEL=gemini-embedding-2`; reseed Qdrant after changing embedding models because vector spaces are not compatible.

4. Start Qdrant:

```bash
docker compose up -d
```

5. Check Qdrant:

```bash
npm run check:qdrant
```

6. Seed vectors:

```bash
npm run seed
```

7. Start the app:

```bash
npm run dev
```

Open `http://localhost:3000`.

## Scripts

```bash
npm test
npm run check:qdrant
npm run seed
npm run dev
npm run evaluate
```

## Dataset

The app uses:

```txt
dataset/surgical_device_dataset_v2_enriched.json
```

Each record is embedded from `embedding_text_vi`, then stored in Qdrant with the full display payload.

## API

### `GET /health`

Returns:

```json
{ "ok": true }
```

### `POST /api/search`

Request:

```json
{
  "text": "lấy dao siêu âm J&J vừa cắt vừa hàn mạch",
  "limit": 3
}
```

Response includes `query`, `hints`, `results`, and optional debug metadata.

### `GET /api/devices/:deviceId`

Returns a full dataset record.

### `POST /api/feedback`

Saves user confirmation to `storage/feedback_log.jsonl`.

```json
{
  "query": "lấy dao siêu âm J&J",
  "selected_device_id": "DEV001",
  "results_snapshot": []
}
```
