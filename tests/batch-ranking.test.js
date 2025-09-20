import test from 'node:test'
import assert from 'node:assert/strict'

import { rankCandidates, makeDeterministicModel } from '../lib/search-handler.js'

function makeItems(n) {
  const items = []
  for (let i = 1; i <= n; i++) {
    items.push({
      id: `id-${String(i).padStart(3, '0')}`,
      price: 80 + (i % 50),
      brand: i % 2 === 0 ? 'Hoka' : 'Nike',
      rating: 3 + ((i % 20) / 20) * 2, // 3.0..5.0
      shipDays: (i % 7) + 1,
      features: { waterproof: i % 3 === 0 },
    })
  }
  return items
}

test('batch ranking makes multiple judge calls and returns stable order', async () => {
  const query = 'waterproof under $200'
  const weights = { price: 0.4, shipping: 0.2, features: 0.2, brand: 0.1, rating: 0.1 }
  const items = makeItems(120)
  const model = makeDeterministicModel({ query, weights, items })
  const { items: ranked, meta } = await rankCandidates({ model, query, weights, items, batchSize: 50, perBatchTopN: 10 })
  assert.ok(meta.numCalls >= 4, 'expected at least 3 chunks + 1 reduce')
  assert.equal(ranked.length, 30)
  // ensure order descending
  for (let i = 1; i < ranked.length; i++) {
    assert.ok(ranked[i - 1].overall >= ranked[i].overall)
  }
  // no duplicates
  const ids = new Set(ranked.map((r) => r.id))
  assert.equal(ids.size, ranked.length)
})

test('handles last underfull chunk', async () => {
  const query = 'waterproof'
  const weights = { price: 0.3, shipping: 0.2, features: 0.3, brand: 0.1, rating: 0.1 }
  const items = makeItems(101) // 50 + 50 + 1
  const model = makeDeterministicModel({ query, weights, items })
  const { items: ranked, meta } = await rankCandidates({ model, query, weights, items, batchSize: 50, perBatchTopN: 5 })
  assert.ok(meta.numCalls >= 3)
  const chunks = Math.ceil(items.length / 50)
  const lastChunkSize = items.length % 50 || 50
  const expected = (chunks - 1) * 5 + Math.min(5, lastChunkSize)
  assert.equal(ranked.length, expected)
})

test('exactly batchSize uses single call path', async () => {
  const query = 'under $200'
  const weights = { price: 0.4, shipping: 0.2, features: 0.2, brand: 0.1, rating: 0.1 }
  const items = makeItems(50)
  const model = makeDeterministicModel({ query, weights, items })
  const { items: ranked, meta } = await rankCandidates({ model, query, weights, items, batchSize: 50, perBatchTopN: 10 })
  assert.equal(meta.numCalls, 1)
  assert.equal(ranked.length, 50)
  for (let i = 1; i < ranked.length; i++) {
    assert.ok(ranked[i - 1].overall >= ranked[i].overall)
  }
})
