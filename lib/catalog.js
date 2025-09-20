// Catalog loader with Zod validation and simple in-memory index
// Implemented in JS for compatibility with the project's node:test setup.

import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import z from 'zod'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Schema mirroring the Product shape
export const ProductSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  category: z.string().min(1),
  brand: z.string().min(1),
  price: z.number().gt(0),
  rating: z.number().min(0).max(5),
  reviewsCount: z.number().int().min(0),
  shipDays: z.number().int().min(0),
  features: z.record(z.union([z.string(), z.number(), z.boolean()])),
  url: z.string().url(),
  image: z.string().min(1),
})

/** @typedef {import('zod').infer<typeof ProductSchema>} Product */

/**
 * Read and validate the catalog file once.
 * @returns {Promise<Product[]>}
 */
export async function loadCatalog() {
  const jsonPath = path.resolve(process.cwd(), 'data', 'catalog.json')
  const raw = await fs.readFile(jsonPath, 'utf8')
  const parsed = JSON.parse(raw)
  const result = z.array(ProductSchema).safeParse(parsed)
  if (!result.success) {
    throw new Error('Invalid catalog.json: ' + result.error.toString())
  }
  return result.data
}

/**
 * Build a simple index for the catalog.
 * @param {Product[]} products
 */
export function buildIndex(products) {
  /** @type {Map<string, Product>} */
  const byId = new Map()
  /** @type {Map<string, Product[]>} */
  const byBrand = new Map()
  /** @type {Map<string, Product[]>} */
  const byCategory = new Map()

  for (const p of products) {
    byId.set(p.id, p)
    const bList = byBrand.get(p.brand) || []
    bList.push(p)
    byBrand.set(p.brand, bList)
    const cList = byCategory.get(p.category) || []
    cList.push(p)
    byCategory.set(p.category, cList)
  }

  return { byId, byBrand, byCategory, all: products.slice() }
}

// Memoized singleton accessor
let _cached = /** @type {null | { products: Product[]; index: ReturnType<typeof buildIndex> }} */ (null)
let _reads = 0 // for test visibility

/**
 * Get the memoized catalog and index.
 * @returns {Promise<{products: Product[]; index: ReturnType<typeof buildIndex>}>}
 */
export async function getCatalog() {
  if (_cached) return _cached
  const products = await loadCatalog()
  _reads += 1
  const index = buildIndex(products)
  _cached = { products, index }
  return _cached
}

// Test helper to assert memoization behavior
export function __getReadCount() {
  return _reads
}

