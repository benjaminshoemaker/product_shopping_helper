import type { z } from 'zod'

export const WeightsSchema: z.ZodObject<{
  price: z.ZodNumber
  shipping: z.ZodNumber
  features: z.ZodNumber
  brand: z.ZodNumber
  rating: z.ZodNumber
}>

export const ItemInputSchema: z.ZodObject<{
  id: z.ZodString
  price: z.ZodNumber
  brand: z.ZodString
  rating: z.ZodNumber
  shipDays: z.ZodNumber
  features: z.ZodRecord<z.ZodString, z.ZodUnion<[z.ZodString, z.ZodNumber, z.ZodBoolean]>>
}>

export const OutputSchema: z.ZodObject<{
  constraints: z.ZodObject<any>
  weights: typeof WeightsSchema
  items: z.ZodArray<z.ZodObject<{
    id: z.ZodString
    overall: z.ZodNumber
    reason: z.ZodString
  }>>
}>

export type Weights = z.infer<typeof WeightsSchema>
export type ItemInput = z.infer<typeof ItemInputSchema>
export type RankOutput = z.infer<typeof OutputSchema>

export function buildPrompt(query: string, weights: Weights, items: ItemInput[]): string
export function parseOutput(text: string): RankOutput

export function rankWithModel(args: {
  model: (prompt: string) => Promise<string> | string
  query: string
  weights: Weights
  items: ItemInput[]
}): Promise<
  | { ok: true; data: RankOutput }
  | { ok: false; error: { type: 'JsonParseError' | 'SchemaError'; message: string; raw?: unknown } }
>

