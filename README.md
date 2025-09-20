# Product Match Finder

## Search API

- Route: `POST /api/search`
- Body:
  - `query: string` (required)
  - `weights?: { price:0..1, shipping:0..1, features:0..1, brand:0..1, rating:0..1 }` (optional)
  - `topK?: number` (optional, default 60)
- Behavior:
  - Reads the catalog, selects up to `topK` items, maps fields the judge needs, calls the judge, and returns ranked results.
- Success response (200):
  - `{ constraints, weights, items: [{ id, overall, reason }...], meta: { model, temperature, tokensIn?, tokensOut?, cacheHit? } }`
- Schema error (422):
  - `{ error: { code: "LLM_SCHEMA_ERROR" }, fallback: true, items: <unranked subset sorted by price asc, rating desc> }`
- Timeout (504):
  - `{ error: { code: "TIMEOUT" }, fallback: true, items: <unranked subset sorted by price asc, rating desc> }`

Notes:
- The endpoint uses a deterministic judge for ranking with `temperature: 0` and validates model output against a strict schema. On schema failure, it retries once before returning a 422 with a fallback ordering.

