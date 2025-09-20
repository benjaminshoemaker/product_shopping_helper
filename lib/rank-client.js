// Pure client that builds a strict prompt, calls a provided `model` function,
// and validates the JSON-only response against a schema. Retries once on schema failure.

import z from 'zod'

// Input schemas (runtime validation for safety if desired externally)
export const WeightsSchema = z.object({
  price: z.number().min(0).max(1),
  shipping: z.number().min(0).max(1),
  features: z.number().min(0).max(1),
  brand: z.number().min(0).max(1),
  rating: z.number().min(0).max(1),
})

export const ItemInputSchema = z.object({
  id: z.string(),
  price: z.number(),
  brand: z.string(),
  rating: z.number(),
  shipDays: z.number(),
  features: z.record(z.union([z.string(), z.number(), z.boolean()])),
})

export const OutputSchema = z.object({
  constraints: z.object({}).passthrough(),
  weights: WeightsSchema,
  items: z.array(
    z.object({
      id: z.string(),
      overall: z.number().min(0).max(1),
      reason: z.string().min(1),
    }),
  ),
})

/**
 * Build a clear, strict prompt for the model.
 * - JSON output only
 * - Do not invent attributes; only use fields provided
 * - Low temperature
 * @param {string} query
 * @param {import('zod').infer<typeof WeightsSchema>} weights
 * @param {Array<import('zod').infer<typeof ItemInputSchema>>} items
 */
export function buildPrompt(query, weights, items) {
  const header = [
    'Task: Rank the provided items against the user query.',
    'Rules:',
    '- Output JSON only.',
    '- Do not invent attributes.',
    '- Use only the fields provided for each item.',
    '- Be conservative; avoid guessing.',
    '- Temperature: low (0).',
    'Schema:',
    '{"constraints": {...}, "weights": {"price":0-1,"shipping":0-1,"features":0-1,"brand":0-1,"rating":0-1}, "items": [{"id": string, "overall": 0..1, "reason": string}] }',
  ].join('\n')

  const payload = {
    query,
    weights,
    items,
    instructions: 'Return ONLY valid JSON matching the schema. No prose.',
  }
  return `${header}\n\nInput:\n${JSON.stringify(payload, null, 2)}`
}

/**
 * Parse and validate model output.
 * @param {string} text
 */
export function parseOutput(text) {
  let parsed
  try {
    parsed = JSON.parse(text)
  } catch (e) {
    const err = new Error('Invalid JSON from model')
    err.name = 'JsonParseError'
    err.cause = e
    throw err
  }
  const result = OutputSchema.safeParse(parsed)
  if (!result.success) {
    const err = new Error('Schema validation failed')
    err.name = 'SchemaError'
    err.details = result.error
    err.raw = parsed
    throw err
  }
  return result.data
}

/**
 * Run the model with a strict prompt and validate its output. Retries once with a stricter reminder on schema/JSON failure.
 * The `model` is a pure function: (prompt: string) => Promise<string> | string
 * @param {{
 *   model: (prompt: string) => Promise<string> | string,
 *   query: string,
 *   weights: import('zod').infer<typeof WeightsSchema>,
 *   items: Array<import('zod').infer<typeof ItemInputSchema>>,
 * }} args
 * @returns {Promise<{ok: true, data: import('zod').infer<typeof OutputSchema>} | {ok:false, error: { type: 'JsonParseError' | 'SchemaError', message: string, raw?: unknown } }>} 
 */
export async function rankWithModel({ model, query, weights, items }) {
  const prompt = buildPrompt(query, weights, items)
  const call = async (p) => Promise.resolve(model(p))
  try {
    const first = await call(prompt)
    const data = parseOutput(first)
    return { ok: true, data }
  } catch (e) {
    const strictPrompt = `${prompt}\n\nReminder: JSON output only. EXACTLY the required schema. No additional fields.`
    try {
      const second = await call(strictPrompt)
      const data = parseOutput(second)
      return { ok: true, data }
    } catch (e2) {
      const type = e2?.name === 'JsonParseError' ? 'JsonParseError' : 'SchemaError'
      return { ok: false, error: { type, message: e2?.message || 'Unknown error', raw: e2?.raw } }
    }
  }
}

