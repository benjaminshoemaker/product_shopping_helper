import test from 'node:test'
import assert from 'node:assert/strict'

import { handleSearch } from '../lib/search-handler.js'

const base = { query: 'waterproof under $160' }

test('endpoint returns ordered items by overall', async () => {
  const res = await handleSearch({ body: { ...base, topK: 10, weights: { price: 0.4, shipping: 0.2, features: 0.2, brand: 0.1, rating: 0.1 } } })
  assert.equal(res.status, 200)
  const { items } = res.body
  assert.ok(Array.isArray(items) && items.length > 0)
  for (let i = 1; i < items.length; i++) {
    assert.ok(items[i - 1].overall >= items[i].overall)
  }
})

test('schema error returns 422 with fallback ordering', async () => {
  const res = await handleSearch({ body: { ...base, topK: 8 }, headers: { 'x-test-mode': 'schema-error' } })
  assert.equal(res.status, 422)
  assert.equal(res.body.fallback, true)
  const { items } = res.body
  // ensure price asc, rating desc tie-breaker for first few
  for (let i = 1; i < items.length; i++) {
    const a = items[i - 1]
    const b = items[i]
    if (a.price === b.price) {
      assert.ok(a.rating >= b.rating)
    } else {
      assert.ok(a.price <= b.price)
    }
  }
})

test('missing query -> 400', async () => {
  const res = await handleSearch({ body: { topK: 5 } })
  assert.equal(res.status, 400)
})

test('timeout returns 504 with fallback ordering', async () => {
  const res = await handleSearch({ body: { query: 'waterproof', topK: 12 }, headers: { 'x-test-mode': 'timeout' } })
  assert.equal(res.status, 504)
  assert.equal(res.body.fallback, true)
  const items = res.body.items
  for (let i = 1; i < items.length; i++) {
    const a = items[i - 1]
    const b = items[i]
    if (a.price === b.price) {
      assert.ok(a.rating >= b.rating)
    } else {
      assert.ok(a.price <= b.price)
    }
  }
})

test('explanation passes through when provided by judge', async () => {
  const res = await handleSearch({ body: { query: 'waterproof', topK: 6 }, headers: { 'x-test-mode': 'explain' } })
  assert.equal(res.status, 200)
  assert.ok(res.body.explanation)
  assert.ok(typeof res.body.explanation.whyTop === 'string')
})
