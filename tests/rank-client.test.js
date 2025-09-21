import test from 'node:test'
import assert from 'node:assert/strict'

import { WeightsSchema, ItemInputSchema, OutputSchema, buildPrompt, parseOutput, rankWithModel } from '../lib/rank-client.js'

const weights = { price: 0.4, shipping: 0.2, features: 0.2, brand: 0.1, rating: 0.1 }
const items = [
  { id: 'a', price: 100, brand: 'Nike', rating: 4.5, shipDays: 3, features: { waterproof: false } },
  { id: 'b', price: 150, brand: 'Hoka', rating: 4.7, shipDays: 5, features: { waterproof: true } },
]

test('schema: accepts valid payload', () => {
  const payload = {
    constraints: { query: 'under $150 waterproof' },
    weights,
    items: [
      { id: 'a', overall: 0.82, reason: 'Good price; not waterproof' },
      { id: 'b', overall: 0.91, reason: 'Waterproof; slightly higher price' },
    ],
    explanation: {
      whyTop: 'Short block explaining ordering by price and rating.',
      whatCouldChange: ['If shipping mattered more...'],
      missingData: ['battery_life_hours'],
    },
  }
  assert.doesNotThrow(() => OutputSchema.parse(payload))
})

test('schema: rejects invalid payload', () => {
  const bad = {
    constraints: { query: 'x' },
    weights: { ...weights, price: 1.2 }, // invalid > 1
    items: [{ id: 'a', overall: 2, reason: '' }], // invalid overall, empty reason
  }
  assert.throws(() => OutputSchema.parse(bad))
})

test('schema: explanation is optional (absent still validates)', () => {
  const payload = {
    constraints: { query: 'q' },
    weights,
    items: [{ id: 'a', overall: 0.5, reason: 'ok' }],
  }
  assert.doesNotThrow(() => OutputSchema.parse(payload))
})

test('parseOutput: detects non-JSON', () => {
  assert.throws(() => parseOutput('not json'), { name: 'JsonParseError' })
})

test('client: success path with fake model', async () => {
  const model = () =>
    JSON.stringify({
      constraints: { query: 'waterproof under $150' },
      weights,
      items: [
        { id: 'a', overall: 0.8, reason: 'Under budget' },
        { id: 'b', overall: 0.9, reason: 'Waterproof' },
      ],
    })
  const res = await rankWithModel({ model, query: 'q', weights, items })
  assert.equal(res.ok, true)
  if (res.ok) {
    assert.equal(res.data.items.length, 2)
  }
})

test('client: retries once on schema failure, then succeeds', async () => {
  let calls = 0
  const model = () => {
    calls += 1
    if (calls === 1) return '{"oops":"not matching"}' // schema fail
    return JSON.stringify({
      constraints: { query: 'q' },
      weights,
      items: [
        { id: 'a', overall: 0.8, reason: 'ok' },
        { id: 'b', overall: 0.7, reason: 'ok' },
      ],
    })
  }
  const res = await rankWithModel({ model, query: 'q', weights, items })
  assert.equal(res.ok, true)
  assert.equal(calls, 2)
})

test('client: retries once then returns structured error', async () => {
  let calls = 0
  const model = () => {
    calls += 1
    return '{"invalid":true}' // always invalid
  }
  const res = await rankWithModel({ model, query: 'q', weights, items })
  assert.equal(res.ok, false)
  if (!res.ok) {
    assert.ok(res.error.type === 'SchemaError' || res.error.type === 'JsonParseError')
  }
  assert.equal(calls, 2)
})

test('client: retries on JSON parse error then succeeds', async () => {
  let calls = 0
  const model = () => {
    calls += 1
    if (calls === 1) return 'not json at all'
    return JSON.stringify({
      constraints: { query: 'q' },
      weights,
      items: [
        { id: 'a', overall: 0.8, reason: 'ok' },
        { id: 'b', overall: 0.7, reason: 'ok' },
      ],
    })
  }
  const res = await rankWithModel({ model, query: 'q', weights, items })
  assert.equal(res.ok, true)
  assert.equal(calls, 2)
})
