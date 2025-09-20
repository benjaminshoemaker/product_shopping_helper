import type { z } from 'zod'

export const ProductSchema: z.ZodObject<{
  id: z.ZodString
  title: z.ZodString
  category: z.ZodString
  brand: z.ZodString
  price: z.ZodNumber
  rating: z.ZodNumber
  reviewsCount: z.ZodNumber
  shipDays: z.ZodNumber
  features: z.ZodRecord<z.ZodString, z.ZodUnion<[z.ZodString, z.ZodNumber, z.ZodBoolean]>>
  url: z.ZodString
  image: z.ZodString
}>

export type Product = z.infer<typeof ProductSchema>

export function loadCatalog(): Promise<Product[]>

export function buildIndex(products: Product[]): {
  byId: Map<string, Product>
  byBrand: Map<string, Product[]>
  byCategory: Map<string, Product[]>
  all: Product[]
}

export function getCatalog(): Promise<{ products: Product[]; index: ReturnType<typeof buildIndex> }>

// test-only helper
export function __getReadCount(): number

