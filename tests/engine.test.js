import test from 'node:test'
import assert from 'node:assert/strict'

import { parseCriteria, scoreProduct, rankProducts, buildSummary } from '../lib/engine.js'

const CATALOG = [
  { id: 'a', name: 'Pegasus Trail 4', brand: 'Nike', price: 119.99, weight_oz: 9.5, waterproof: false, width: 'regular', drop_mm: 9, cushion: 'mid', ship_days: 3, rating: 4.5 },
  { id: 'b', name: 'Speedgoat 5 GTX', brand: 'Hoka', price: 159.99, weight_oz: 10.3, waterproof: true, width: 'wide', drop_mm: 4, cushion: 'high', ship_days: 5, rating: 4.7 },
  { id: 'c', name: 'Cascadia 17', brand: 'Brooks', price: 129.95, weight_oz: 10.5, waterproof: false, width: 'wide', drop_mm: 8, cushion: 'mid', ship_days: 2, rating: 4.6 },
]

const defaultWeights = { price: 0.3, shipping: 0.2, waterproof: 0.25, weight: 0.15, width: 0.2, brand: 0.1, cushion: 0.15 }

test('parseCriteria extracts core fields', () => {
  const q = "Waterproof under $140, wide feet, within 3 days, mid cushion, prefer Hoka"
  const c = parseCriteria(q)
  assert.equal(c.waterproof, true)
  assert.equal(c.price_cap, 140)
  assert.equal(c.ship_days, 3)
  assert.equal(c.width, 'wide')
  assert.equal(c.cushion, 'mid')
  assert.ok(Array.isArray(c.brand_prefer) && c.brand_prefer.includes('hoka'))
})

test('scoreProduct rewards matching attributes', () => {
  const criteria = { price_cap: 140, waterproof: true }
  const good = scoreProduct(CATALOG[1], criteria, defaultWeights) // Hoka GTX waterproof
  const bad = scoreProduct(CATALOG[0], criteria, defaultWeights) // Nike not waterproof
  assert.ok(good.overallScore > bad.overallScore)
  const waterproofCrit = good.criterionScores.find((c) => c.name === 'Waterproof')
  assert.equal(waterproofCrit?.score, 1)
})

test('rankProducts sorts by descending score', () => {
  const criteria = { price_cap: 140, ship_days: 3 }
  const ranked = rankProducts(CATALOG, criteria, defaultWeights)
  assert.equal(ranked.length, 3)
  for (let i = 1; i < ranked.length; i++) {
    assert.ok(ranked[i - 1].overallScore >= ranked[i].overallScore)
  }
})

test('buildSummary mentions winner and value', () => {
  const criteria = { price_cap: 140, ship_days: 3 }
  const ranked = rankProducts(CATALOG, criteria, defaultWeights)
  const summary = buildSummary(criteria, ranked)
  assert.ok(typeof summary === 'string' && summary.length > 0)
  const winner = ranked[0].product
  assert.ok(summary.toLowerCase().includes(winner.brand.toLowerCase()))
})
