import z from 'zod'
import { getCatalog } from './catalog.js'
import { buildPrompt, rankWithModel, WeightsSchema, ItemInputSchema, OutputSchema } from './rank-client.js'

const RequestSchema = z.object({
  query: z.string().min(1, 'query is required'),
  weights: WeightsSchema.partial().optional(),
  topK: z.number().int().min(1).max(200).optional(),
})

function toJudgeItems(products) {
  return products.map((p) => ({
    id: p.id,
    price: p.price,
    brand: p.brand,
    rating: p.rating,
    shipDays: p.shipDays,
    features: p.features || {},
  }))
}

function fallbackItems(products) {
  const sorted = products.slice().sort((a, b) => {
    if (a.price !== b.price) return a.price - b.price
    return b.rating - a.rating
  })
  return toJudgeItems(sorted)
}

function fallbackJudgeItems(items) {
  return items.slice().sort((a, b) => {
    if (a.price !== b.price) return a.price - b.price
    return b.rating - a.rating
  })
}

export function makeDeterministicModel(scoped) {
  return (prompt) => {
    // Extract the last JSON block after 'Input:\n'
    const marker = 'Input:\n'
    const idx = prompt.lastIndexOf(marker)
    const json = idx >= 0 ? prompt.slice(idx + marker.length) : '{}'
    let parsed
    try { parsed = JSON.parse(json) } catch { parsed = { query: scoped.query, weights: scoped.weights, items: scoped.items } }
    const { query, weights, items } = parsed
    const minPrice = Math.min(...items.map((i) => i.price))
    const maxPrice = Math.max(...items.map((i) => i.price))
    const minShip = Math.min(...items.map((i) => i.shipDays))
    const maxShip = Math.max(...items.map((i) => i.shipDays))
    const denom = (x, y) => (x === y ? 1 : y - x)
    const w = { price: 0.3, shipping: 0.2, features: 0.2, brand: 0.1, rating: 0.2, ...(weights || {}) }
    const sumW = Object.values(w).reduce((a, b) => a + b, 0) || 1
    const qLower = String(query || '').toLowerCase()
    const wantsWater = /waterproof|gtx|gore-tex/.test(qLower)

    const scored = items.map((i) => {
      const priceScore = 1 - (i.price - minPrice) / denom(minPrice, maxPrice)
      const shipScore = 1 - (i.shipDays - minShip) / denom(minShip, maxShip)
      const brandScore = qLower.includes(String(i.brand).toLowerCase()) ? 1 : 0.5
      const featuresScore = wantsWater ? (i.features?.waterproof ? 1 : 0) : 0.5
      const ratingScore = Math.max(0, Math.min(1, i.rating / 5))
      const overall =
        (priceScore * w.price + shipScore * w.shipping + featuresScore * w.features + brandScore * w.brand + ratingScore * w.rating) /
        sumW
      const reasons = []
      if (priceScore > 0.7) reasons.push('good price')
      if (shipScore > 0.7) reasons.push('fast shipping')
      if (featuresScore > 0.7 && wantsWater) reasons.push('waterproof')
      if (ratingScore > 0.8) reasons.push('high rating')
      return { id: i.id, overall: Math.max(0, Math.min(1, Number(overall.toFixed(3)))), reason: reasons.join('; ') || 'balanced' }
    })
    scored.sort((a, b) => b.overall - a.overall)
    let explanation
    if (scoped.includeExplanation) {
      const top = scored.slice(0, 3)
      const names = top.map((t) => t.id).join(', ')
      const whyTop = `Top results (${names}) reflect better price-to-rating balance and faster shipping based on the provided weights. Waterproof items are prioritized only when explicitly requested by the query, otherwise treated neutrally.`
      const whatCouldChange = [
        'If shipping speed mattered more, items with lower shipDays would move up.',
        'If price weight decreased, higher-rated items might outrank cheaper ones.',
      ]
      const missingData = []
      explanation = { whyTop, whatCouldChange, missingData }
    }
    return JSON.stringify({ constraints: { query }, weights: w, items: scored, ...(explanation ? { explanation } : {}) })
  }
}

/**
 * Batch ranking: chunk -> judge -> pick top per chunk -> merge -> judge again.
 * @param {{
 *  model: (prompt: string) => Promise<string> | string,
 *  query: string,
 *  weights: Record<string, number>,
 *  items: Array<{id:string,price:number,brand:string,rating:number,shipDays:number,features:Record<string, any>}>,
 *  batchSize?: number,
 *  perBatchTopN?: number,
 * }} args
 */
export async function rankCandidates({ model, query, weights, items, batchSize = 50, perBatchTopN = 10 }) {
  let numCalls = 0
  const call = async (subset) => {
    numCalls += 1
    return rankWithModel({ model, query, weights, items: subset })
  }

  if (items.length <= batchSize) {
    const res = await call(items)
    if (!res.ok) {
      const fb = fallbackJudgeItems(items)
      return { items: fb.map((i) => ({ id: i.id, overall: 0.5, reason: 'fallback' })), meta: { numCalls } }
    }
    const data = res.data
    data.items.sort((a, b) => b.overall - a.overall)
    return { items: data.items, meta: { numCalls }, explanation: data.explanation }
  }

  // Map phase: chunk and rank
  const chunks = []
  for (let i = 0; i < items.length; i += batchSize) {
    chunks.push(items.slice(i, i + batchSize))
  }

  const candidates = []
  for (const chunk of chunks) {
    const res = await call(chunk)
    if (res.ok) {
      const ranked = res.data.items.slice().sort((a, b) => b.overall - a.overall)
      candidates.push(...ranked.slice(0, perBatchTopN))
    } else {
      const fb = fallbackJudgeItems(chunk).slice(0, perBatchTopN)
      candidates.push(...fb.map((i) => ({ id: i.id, overall: 0.5, reason: 'fallback' })))
    }
  }

  // Dedupe candidates by id, keep best overall per id
  const byId = new Map()
  for (const c of candidates) {
    const prev = byId.get(c.id)
    if (!prev || c.overall > prev.overall) byId.set(c.id, c)
  }
  const merged = Array.from(byId.values())

  // Reduce phase: re-judge on merged candidates (map back to judge input fields)
  const mergedInputs = merged.map((c) => items.find((i) => i.id === c.id)).filter(Boolean)
  const res = await call(mergedInputs)
  if (!res.ok) {
    const fb = fallbackJudgeItems(mergedInputs)
    return { items: fb.map((i) => ({ id: i.id, overall: 0.5, reason: 'fallback' })), meta: { numCalls } }
  }
  const finalItems = res.data.items.slice().sort((a, b) => b.overall - a.overall)
  return { items: finalItems, meta: { numCalls }, explanation: res.data.explanation }
}

/**
 * Pure handler for search ranking.
 * @param {{ body: unknown, headers?: Record<string,string|undefined> }} req
 * @returns {Promise<{ status: number, body: any }>}
 */
export async function handleSearch({ body, headers = {} }) {
  // Validate input
  const parsed = RequestSchema.safeParse(body)
  if (!parsed.success) {
    return { status: 400, body: { error: { code: 'BAD_REQUEST', details: parsed.error.flatten() } } }
  }
  const { query, weights = {}, topK = 60 } = parsed.data

  // Load catalog and slice
  const { products } = await getCatalog()
  const subset = products.slice(0, Math.min(topK, products.length))
  const judgeItems = toJudgeItems(subset)

  // Choose model behavior (test hooks)
  const testMode = (headers['x-test-mode'] || '').toString()
  let model
  if (testMode === 'schema-error') {
    model = () => '{"invalid":true}'
  } else if (testMode === 'timeout') {
    model = () => new Promise(() => {}) // never resolves
  } else if (testMode === 'explain' || testMode === 'with-explanation') {
    model = makeDeterministicModel({ query, weights, items: judgeItems, includeExplanation: true })
  } else {
    model = makeDeterministicModel({ query, weights, items: judgeItems, includeExplanation: true })
  }

  // Determine if batching is needed
  const batchSize = 50
  const perBatchTopN = 10

  // Call judge with timeout
  const controller = new AbortController()
  const timeoutMs = 800
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  const run = (async () => {
    if (judgeItems.length > batchSize) {
      const { items: ranked, meta, explanation } = await rankCandidates({ model, query, weights, items: judgeItems, batchSize, perBatchTopN })
      return { ok: true, data: { constraints: { query }, weights, items: ranked, meta, ...(explanation ? { explanation } : {}) } }
    } else {
      const r = await rankWithModel({ model, query, weights, items: judgeItems })
      return r
    }
  })()
  let result
  try {
    result = await Promise.race([
      run,
      new Promise((_, rej) => controller.signal.addEventListener('abort', () => rej(new Error('Timeout')))),
    ])
  } catch (e) {
    clearTimeout(timeout)
    // Timeout → 504 with fallback
    return { status: 504, body: { error: { code: 'TIMEOUT' }, fallback: true, items: fallbackItems(subset) } }
  }
  clearTimeout(timeout)

  if (!result.ok) {
    // Schema error → 422 with fallback
    return { status: 422, body: { error: { code: 'LLM_SCHEMA_ERROR' }, fallback: true, items: fallbackItems(subset) } }
  }

  const { data } = result
  // Order is already by overall in our model, but enforce sort
  data.items.sort((a, b) => b.overall - a.overall)

  const meta = { model: 'deterministic-mock', temperature: 0, numCalls: data.meta?.numCalls || 1 }
  return { status: 200, body: { constraints: data.constraints || { query }, weights: data.weights, items: data.items, ...(data.explanation ? { explanation: data.explanation } : {}), meta } }
}
