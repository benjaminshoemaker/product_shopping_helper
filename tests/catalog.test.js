import test from 'node:test'
import assert from 'node:assert/strict'

import { loadCatalog, buildIndex, getCatalog, __getReadCount } from '../lib/catalog.js'

test('catalog parses and validates all items', async () => {
  const products = await loadCatalog()
  assert.ok(Array.isArray(products))
  assert.ok(products.length >= 45, 'expected ~50 items')
  const ids = new Set()
  for (const p of products) {
    assert.ok(p.id && typeof p.id === 'string')
    assert.ok(!ids.has(p.id), 'duplicate id ' + p.id)
    ids.add(p.id)
    assert.ok(p.price > 0)
    assert.ok(p.rating >= 0 && p.rating <= 5)
    assert.ok(p.shipDays >= 0)
  }
})

test('index builds expected maps', async () => {
  const products = await loadCatalog()
  const idx = buildIndex(products)
  assert.equal(idx.all.length, products.length)
  // byId contains every item
  for (const p of products) {
    assert.equal(idx.byId.get(p.id)?.id, p.id)
  }
  // at least one category and brand grouping present
  assert.ok(idx.byCategory.size >= 2)
  assert.ok(idx.byBrand.size >= 2)
})

test('getCatalog memoizes results and avoids re-reading', async () => {
  const a = await getCatalog()
  const b = await getCatalog()
  assert.strictEqual(a, b)
  assert.equal(__getReadCount(), 1)
})

