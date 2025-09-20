export type Product = {
  id: string
  name: string
  brand: string
  price: number
  weight_oz: number
  waterproof: boolean
  width: 'narrow' | 'regular' | 'wide'
  drop_mm: number
  cushion: 'low' | 'mid' | 'high'
  ship_days: number
  rating: number
  image?: string
}

export type ParsedCriteria = {
  price_cap?: number
  ship_days?: number
  waterproof?: boolean
  weight_oz?: number
  width?: 'narrow' | 'regular' | 'wide'
  brand_prefer?: string[]
  brand_avoid?: string[]
  cushion?: 'low' | 'mid' | 'high'
  light?: boolean
}

export type CriterionScore = {
  name: string
  weight: number
  enabled: boolean
  score: number
  reason: string
  target?: string
  actual?: string
}

export type ScoredProduct = {
  product: Product
  overallScore: number
  criterionScores: CriterionScore[]
}

