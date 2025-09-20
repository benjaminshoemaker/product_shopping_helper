"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Search,
  ChevronDown,
  ChevronUp,
  Zap,
  Star,
  Package,
  Clock,
  ChevronLeft,
  ChevronRight,
  Grid3X3,
  RotateCcw,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Slider } from "@/components/ui/slider"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

// Types
type Product = {
  id: string
  name: string
  brand: string
  price: number
  weight_oz: number
  waterproof: boolean
  width: "narrow" | "regular" | "wide"
  drop_mm: number
  cushion: "low" | "mid" | "high"
  ship_days: number
  rating: number
  image?: string
}

type ParsedCriteria = {
  price_cap?: number
  ship_days?: number
  waterproof?: boolean
  weight_oz?: number
  width?: "narrow" | "regular" | "wide"
  brand_prefer?: string[]
  brand_avoid?: string[]
  cushion?: "low" | "mid" | "high"
  light?: boolean
}

type CriterionScore = {
  name: string
  weight: number
  enabled: boolean
  score: number
  reason: string
  target?: string
  actual?: string
}

type ScoredProduct = {
  product: Product
  overallScore: number
  criterionScores: CriterionScore[]
}

// Mock catalog
const CATALOG: Product[] = [
  {
    id: "ff_pegasus_trail",
    name: "Pegasus Trail 4",
    brand: "Nike",
    price: 119.99,
    weight_oz: 9.5,
    waterproof: false,
    width: "regular",
    drop_mm: 9,
    cushion: "mid",
    ship_days: 3,
    rating: 4.5,
    image: "/nike-pegasus-trail-4-running-shoes-black-and-orang.jpg",
  },
  {
    id: "rr_speedgoat_5",
    name: "Speedgoat 5 GTX",
    brand: "Hoka",
    price: 159.99,
    weight_oz: 10.3,
    waterproof: true,
    width: "wide",
    drop_mm: 4,
    cushion: "high",
    ship_days: 5,
    rating: 4.7,
    image: "/hoka-speedgoat-5-gtx-trail-running-shoes-blue-and-.jpg",
  },
  {
    id: "am_terrex",
    name: "Terrex Swift R3 GTX",
    brand: "Adidas",
    price: 139.95,
    weight_oz: 13.0,
    waterproof: true,
    width: "regular",
    drop_mm: 10,
    cushion: "mid",
    ship_days: 2,
    rating: 4.3,
    image: "/adidas-terrex-swift-r3-gtx-hiking-shoes-black-and-.jpg",
  },
  {
    id: "br_cascadia",
    name: "Cascadia 17",
    brand: "Brooks",
    price: 129.95,
    weight_oz: 10.5,
    waterproof: false,
    width: "wide",
    drop_mm: 8,
    cushion: "mid",
    ship_days: 2,
    rating: 4.6,
    image: "/brooks-cascadia-17-trail-running-shoes-navy-and-gr.jpg",
  },
  {
    id: "al_lone_peak",
    name: "Lone Peak 8",
    brand: "Altra",
    price: 129.99,
    weight_oz: 10.7,
    waterproof: false,
    width: "wide",
    drop_mm: 0,
    cushion: "mid",
    ship_days: 4,
    rating: 4.4,
    image: "/altra-lone-peak-8-zero-drop-trail-running-shoes-gr.jpg",
  },
  {
    id: "sa_peregrine",
    name: "Peregrine 14 GTX",
    brand: "Saucony",
    price: 149.99,
    weight_oz: 10.2,
    waterproof: true,
    width: "regular",
    drop_mm: 4,
    cushion: "mid",
    ship_days: 3,
    rating: 4.5,
    image: "/saucony-peregrine-14-gtx-trail-running-shoes-purpl.jpg",
  },
]

// Example prompts
const EXAMPLE_PROMPTS = [
  "I need women's trail running shoes under $120, waterproof, light, for wide feet, deliver in 3 days.",
  "Looking for lightweight trail runners under $140, prefer Hoka or Brooks, mid cushioning.",
  "Need waterproof trail shoes under $130, regular width, fast shipping within 2 days.",
]

// Utility functions
function parseCriteria(text: string): ParsedCriteria {
  const criteria: ParsedCriteria = {}
  const lowerText = text.toLowerCase()

  // Price cap
  const priceMatch = lowerText.match(/(?:under|<|below|max)\s*\$?(\d+(?:\.\d{2})?)/i)
  if (priceMatch) {
    criteria.price_cap = Number.parseFloat(priceMatch[1])
  }

  // Delivery days
  const daysMatch = lowerText.match(/(?:in|within)\s*(\d+)\s*days?/i)
  if (daysMatch) {
    criteria.ship_days = Number.parseInt(daysMatch[1])
  }

  // Waterproof
  if (lowerText.includes("waterproof") || lowerText.includes("gtx") || lowerText.includes("gore-tex")) {
    criteria.waterproof = true
  }

  // Weight
  const weightMatch = lowerText.match(/(?:under|<|below)\s*(\d+(?:\.\d+)?)\s*oz/i)
  if (weightMatch) {
    criteria.weight_oz = Number.parseFloat(weightMatch[1])
  }
  if (lowerText.includes("light") || lowerText.includes("ultralight")) {
    criteria.light = true
  }

  // Width
  if (lowerText.includes("wide feet") || lowerText.includes("wide width")) {
    criteria.width = "wide"
  } else if (lowerText.includes("narrow")) {
    criteria.width = "narrow"
  }

  // Brand preferences
  const brands = ["nike", "hoka", "adidas", "brooks", "altra", "saucony"]
  const preferMatch = lowerText.match(/(?:prefer|like|want)\s+([^,.]+)/i)
  if (preferMatch) {
    const preferText = preferMatch[1].toLowerCase()
    criteria.brand_prefer = brands.filter((brand) => preferText.includes(brand))
  }

  const avoidMatch = lowerText.match(/(?:avoid|not|don't want)\s+([^,.]+)/i)
  if (avoidMatch) {
    const avoidText = avoidMatch[1].toLowerCase()
    criteria.brand_avoid = brands.filter((brand) => avoidText.includes(brand))
  }

  // Cushion
  if (lowerText.includes("high cushion") || lowerText.includes("max cushion")) {
    criteria.cushion = "high"
  } else if (lowerText.includes("low cushion") || lowerText.includes("minimal cushion")) {
    criteria.cushion = "low"
  } else if (lowerText.includes("mid cushion") || lowerText.includes("medium cushion")) {
    criteria.cushion = "mid"
  }

  return criteria
}

function scoreProduct(product: Product, criteria: ParsedCriteria, weights: Record<string, number>): ScoredProduct {
  const criterionScores: CriterionScore[] = []
  let totalWeightedScore = 0
  let totalWeight = 0

  // Price scoring
  if (criteria.price_cap !== undefined) {
    const weight = weights.price || 0.3
    let score = 1
    let reason = `No price limit specified`

    if (criteria.price_cap) {
      if (product.price <= criteria.price_cap) {
        score = Math.max(0.8, 1 - (product.price / criteria.price_cap) * 0.2)
        reason = `Target ≤$${criteria.price_cap}, this is $${product.price.toFixed(2)} → ${Math.round(score * 100)}%`
      } else {
        score = Math.max(0, (criteria.price_cap - product.price) / criteria.price_cap + 1)
        reason = `Over budget: $${product.price.toFixed(2)} vs $${criteria.price_cap} → ${Math.round(score * 100)}%`
      }
    }

    criterionScores.push({
      name: "Price",
      weight,
      enabled: true,
      score,
      reason,
      target: criteria.price_cap ? `≤$${criteria.price_cap}` : "Any",
      actual: `$${product.price.toFixed(2)}`,
    })
    totalWeightedScore += weight * score
    totalWeight += weight
  }

  // Shipping days
  if (criteria.ship_days !== undefined) {
    const weight = weights.shipping || 0.2
    let score = 1
    let reason = `Ships in ${product.ship_days} days`

    if (product.ship_days <= criteria.ship_days) {
      score = Math.max(0.8, 1 - (product.ship_days / criteria.ship_days) * 0.2)
      reason = `Target ≤${criteria.ship_days} days, ships in ${product.ship_days} → ${Math.round(score * 100)}%`
    } else {
      score = Math.max(0, (criteria.ship_days - product.ship_days) / criteria.ship_days + 1)
      reason = `Too slow: ${product.ship_days} days vs ${criteria.ship_days} → ${Math.round(score * 100)}%`
    }

    criterionScores.push({
      name: "Shipping",
      weight,
      enabled: true,
      score,
      reason,
      target: `≤${criteria.ship_days} days`,
      actual: `${product.ship_days} days`,
    })
    totalWeightedScore += weight * score
    totalWeight += weight
  }

  // Waterproof
  if (criteria.waterproof !== undefined) {
    const weight = weights.waterproof || 0.25
    const score = product.waterproof === criteria.waterproof ? 1 : 0
    const reason = criteria.waterproof
      ? product.waterproof
        ? "Waterproof ✓"
        : "Not waterproof ✗"
      : product.waterproof
        ? "Waterproof (bonus)"
        : "Not waterproof (as requested)"

    criterionScores.push({
      name: "Waterproof",
      weight,
      enabled: true,
      score,
      reason,
      target: criteria.waterproof ? "Yes" : "No",
      actual: product.waterproof ? "Yes" : "No",
    })
    totalWeightedScore += weight * score
    totalWeight += weight
  }

  // Weight/Light
  if (criteria.weight_oz !== undefined || criteria.light) {
    const weight = weights.weight || 0.15
    let score = 1
    let reason = `${product.weight_oz}oz`

    if (criteria.weight_oz) {
      score =
        product.weight_oz <= criteria.weight_oz
          ? Math.max(0.8, 1 - (product.weight_oz / criteria.weight_oz) * 0.2)
          : Math.max(0.2, 1 - (product.weight_oz - criteria.weight_oz) / 5)
      reason = `Target ≤${criteria.weight_oz}oz, this is ${product.weight_oz}oz → ${Math.round(score * 100)}%`
    } else if (criteria.light) {
      // Consider under 10oz as light
      score =
        product.weight_oz <= 10
          ? Math.max(0.7, 1 - (product.weight_oz / 10) * 0.3)
          : Math.max(0.2, 1 - (product.weight_oz - 10) / 5)
      reason = `Light weight: ${product.weight_oz}oz → ${Math.round(score * 100)}%`
    }

    criterionScores.push({
      name: "Weight",
      weight,
      enabled: true,
      score,
      reason,
      target: criteria.weight_oz ? `≤${criteria.weight_oz}oz` : "Light",
      actual: `${product.weight_oz}oz`,
    })
    totalWeightedScore += weight * score
    totalWeight += weight
  }

  // Width
  if (criteria.width) {
    const weight = weights.width || 0.2
    let score = 0
    let reason = ""

    if (product.width === criteria.width) {
      score = 1
      reason = `Perfect width match: ${criteria.width}`
    } else if (criteria.width === "wide" && product.width === "regular") {
      score = 0.5
      reason = `Regular width (acceptable for wide feet)`
    } else {
      score = 0.1
      reason = `Width mismatch: ${product.width} vs ${criteria.width}`
    }

    criterionScores.push({
      name: "Width",
      weight,
      enabled: true,
      score,
      reason,
      target: criteria.width,
      actual: product.width,
    })
    totalWeightedScore += weight * score
    totalWeight += weight
  }

  // Brand preference
  if (criteria.brand_prefer?.length || criteria.brand_avoid?.length) {
    const weight = weights.brand || 0.1
    let score = 0.5 // neutral
    let reason = "Neutral brand"

    if (criteria.brand_prefer?.includes(product.brand.toLowerCase())) {
      score = 1
      reason = `Preferred brand: ${product.brand}`
    } else if (criteria.brand_avoid?.includes(product.brand.toLowerCase())) {
      score = 0.1
      reason = `Avoided brand: ${product.brand}`
    }

    criterionScores.push({
      name: "Brand",
      weight,
      enabled: true,
      score,
      reason,
      target: criteria.brand_prefer?.join(", ") || "Any",
      actual: product.brand,
    })
    totalWeightedScore += weight * score
    totalWeight += weight
  }

  // Cushion
  if (criteria.cushion) {
    const weight = weights.cushion || 0.15
    let score = 0
    let reason = ""

    if (product.cushion === criteria.cushion) {
      score = 1
      reason = `Perfect cushion match: ${criteria.cushion}`
    } else {
      const cushionOrder = ["low", "mid", "high"]
      const targetIndex = cushionOrder.indexOf(criteria.cushion)
      const actualIndex = cushionOrder.indexOf(product.cushion)
      const diff = Math.abs(targetIndex - actualIndex)

      if (diff === 1) {
        score = 0.6
        reason = `Adjacent cushion level: ${product.cushion} vs ${criteria.cushion}`
      } else {
        score = 0.2
        reason = `Different cushion: ${product.cushion} vs ${criteria.cushion}`
      }
    }

    criterionScores.push({
      name: "Cushion",
      weight,
      enabled: true,
      score,
      reason,
      target: criteria.cushion,
      actual: product.cushion,
    })
    totalWeightedScore += weight * score
    totalWeight += weight
  }

  // If no criteria, use rating as fallback
  if (totalWeight === 0) {
    const weight = 1
    const score = product.rating / 5
    criterionScores.push({
      name: "Rating",
      weight,
      enabled: true,
      score,
      reason: `${product.rating}/5 stars`,
      target: "High rating",
      actual: `${product.rating}/5`,
    })
    totalWeightedScore = score
    totalWeight = weight
  }

  const overallScore = totalWeight > 0 ? totalWeightedScore / totalWeight : 0

  return {
    product,
    overallScore,
    criterionScores,
  }
}

function rankProducts(criteria: ParsedCriteria, weights: Record<string, number>): ScoredProduct[] {
  return CATALOG.map((product) => scoreProduct(product, criteria, weights)).sort(
    (a, b) => b.overallScore - a.overallScore,
  )
}

function buildSummary(criteria: ParsedCriteria, rankedProducts: ScoredProduct[]): string {
  const sentences: string[] = []

  if (rankedProducts.length > 1) {
    const winner = rankedProducts[0]
    const runnerUp = rankedProducts[1]
    const scoreDiff = Math.round((winner.overallScore - runnerUp.overallScore) * 100)

    // Find the strongest criterion for the winner
    const strongestCriterion = winner.criterionScores.reduce((best, current) =>
      current.score * current.weight > best.score * best.weight ? current : best,
    )

    // Find what makes the top product stand out
    const winnerAdvantages = winner.criterionScores
      .filter((c) => c.score > 0.8)
      .sort((a, b) => b.score * b.weight - a.score * a.weight)
      .slice(0, 2)

    sentences.push(
      `${winner.product.brand} ${winner.product.name} ($${winner.product.price.toFixed(2)}) ranks #1 with a ${Math.round(winner.overallScore * 100)}% match, excelling in ${winnerAdvantages.map((a) => a.name.toLowerCase()).join(" and ")}.`,
    )

    if (scoreDiff > 5) {
      sentences.push(
        `It leads ${runnerUp.product.brand} ${runnerUp.product.name} ($${runnerUp.product.price.toFixed(2)}) by ${scoreDiff} points, primarily due to superior ${strongestCriterion.name.toLowerCase()} performance.`,
      )
    } else {
      sentences.push(
        `The competition is tight - ${runnerUp.product.brand} ${runnerUp.product.name} ($${runnerUp.product.price.toFixed(2)}) follows closely with ${Math.round(runnerUp.overallScore * 100)}% match.`,
      )
    }
  } else if (rankedProducts.length === 1) {
    const winner = rankedProducts[0]
    sentences.push(
      `${winner.product.brand} ${winner.product.name} ($${winner.product.price.toFixed(2)}) achieves a ${Math.round(winner.overallScore * 100)}% match based on your criteria.`,
    )
  }

  if (criteria.price_cap) {
    const withinBudget = rankedProducts.filter((p) => p.product.price <= criteria.price_cap!)
    const budgetRanked = withinBudget.slice(0, 3)

    if (budgetRanked.length > 0) {
      const budgetLeader = budgetRanked[0]
      sentences.push(
        `Within your $${criteria.price_cap} budget: ${budgetRanked.length} options available, led by ${budgetLeader.product.brand} ${budgetLeader.product.name} at $${budgetLeader.product.price.toFixed(2)}.`,
      )

      // Check if budget leader differs from overall leader
      if (rankedProducts[0].product.price > criteria.price_cap) {
        sentences.push(
          `While ${rankedProducts[0].product.brand} ${rankedProducts[0].product.name} scores highest overall, it exceeds your budget at $${rankedProducts[0].product.price.toFixed(2)}.`,
        )
      }
    } else {
      sentences.push(
        `No products found within your $${criteria.price_cap} budget - consider increasing to $${Math.min(...rankedProducts.map((p) => p.product.price)).toFixed(2)} for the most affordable option.`,
      )
    }
  } else {
    const priceRange =
      rankedProducts.length > 0
        ? {
            min: Math.min(...rankedProducts.map((p) => p.product.price)),
            max: Math.max(...rankedProducts.map((p) => p.product.price)),
          }
        : null

    if (priceRange && rankedProducts.length > 1) {
      const cheapest = rankedProducts.find((p) => p.product.price === priceRange.min)!
      const mostExpensive = rankedProducts.find((p) => p.product.price === priceRange.max)!
      sentences.push(
        `Price range spans $${priceRange.min.toFixed(2)} (${cheapest.product.brand} ${cheapest.product.name}) to $${priceRange.max.toFixed(2)} (${mostExpensive.product.brand} ${mostExpensive.product.name}).`,
      )
    }
  }

  if (rankedProducts.length > 1) {
    const bestValue = rankedProducts.reduce((best, current) => {
      const valueScore = current.overallScore / (current.product.price / 100) // score per dollar
      const bestValueScore = best.overallScore / (best.product.price / 100)
      return valueScore > bestValueScore ? current : best
    })

    if (bestValue.product.id !== rankedProducts[0].product.id) {
      const valueScore = bestValue.overallScore / (bestValue.product.price / 100)
      sentences.push(
        `Best value proposition: ${bestValue.product.brand} ${bestValue.product.name} delivers ${Math.round(bestValue.overallScore * 100)}% match at just $${bestValue.product.price.toFixed(2)}, offering excellent performance per dollar.`,
      )
    }

    // Mention if there are significant price-performance trade-offs
    const expensiveOptions = rankedProducts.filter((p) => p.product.price > rankedProducts[0].product.price * 1.2)
    if (expensiveOptions.length > 0 && expensiveOptions[0].overallScore > rankedProducts[0].overallScore) {
      const premium = expensiveOptions[0]
      const priceDiff = premium.product.price - rankedProducts[0].product.price
      sentences.push(
        `Premium option: ${premium.product.brand} ${premium.product.name} costs $${priceDiff.toFixed(2)} more but offers ${Math.round((premium.overallScore - rankedProducts[0].overallScore) * 100)} additional match points.`,
      )
    }
  }

  return sentences.join(" ")
}

const CRITERIA_SUGGESTIONS = [
  {
    name: "Heel-to-toe drop",
    description: "Lower drop (0-4mm) for natural running, higher (8-12mm) for heel strikers",
  },
  {
    name: "Traction pattern",
    description: "Aggressive lugs for muddy trails, moderate for mixed terrain",
  },
  {
    name: "Toe box shape",
    description: "Wide toe box for natural toe splay, narrow for racing",
  },
]

export default function ProductMatchFinder() {
  const [query, setQuery] = useState("")
  const [criteria, setCriteria] = useState<ParsedCriteria>({})
  const [weights, setWeights] = useState<Record<string, number>>({
    price: 0.3,
    shipping: 0.2,
    waterproof: 0.25,
    weight: 0.15,
    width: 0.2,
    brand: 0.1,
    cushion: 0.15,
  })
  const [results, setResults] = useState<ScoredProduct[]>([])
  const [summary, setSummary] = useState("")
  const [hasSearched, setHasSearched] = useState(false)
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set())
  const [viewMode, setViewMode] = useState<"grid" | "carousel">("grid")
  const [carouselIndex, setCarouselIndex] = useState(0)

  const handleSearch = () => {
    console.log("[v0] handleSearch called with query:", query)
    const parsed = parseCriteria(query)
    console.log("[v0] parsed criteria:", parsed)
    setCriteria(parsed)
    const ranked = rankProducts(parsed, weights)
    console.log("[v0] ranked products:", ranked.length)
    setResults(ranked)
    setSummary(buildSummary(parsed, ranked))
    setHasSearched(true)
    setCarouselIndex(0)
    console.log("[v0] results state should be updated")
  }

  const updateCriteriaWeight = (criterion: string, weight: number) => {
    setWeights((prev) => ({ ...prev, [criterion]: weight / 100 }))
    if (hasSearched) {
      const ranked = rankProducts(criteria, { ...weights, [criterion]: weight / 100 })
      setResults(ranked)
      setSummary(buildSummary(criteria, ranked))
    }
  }

  const toggleProductExpansion = (productId: string) => {
    setExpandedProducts((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(productId)) {
        newSet.delete(productId)
      } else {
        newSet.add(productId)
      }
      return newSet
    })
  }

  const nextCarouselPage = () => {
    const maxIndex = Math.max(0, Math.ceil(results.length / 2) - 1)
    setCarouselIndex((prev) => Math.min(prev + 1, maxIndex))
  }

  const prevCarouselPage = () => {
    setCarouselIndex((prev) => Math.max(prev - 1, 0))
  }

  const getRelevantCriteria = (parsedCriteria: ParsedCriteria) => {
    const relevantCriteria: Array<{ key: string; label: string; weight: number }> = []

    // Always show price if there's a price cap or if no specific criteria were found
    if (parsedCriteria.price_cap !== undefined || Object.keys(parsedCriteria).length === 0) {
      relevantCriteria.push({ key: "price", label: "Price", weight: weights.price * 100 })
    }

    // Always show shipping if there's a shipping requirement or if no specific criteria were found
    if (parsedCriteria.ship_days !== undefined || Object.keys(parsedCriteria).length === 0) {
      relevantCriteria.push({ key: "shipping", label: "Shipping", weight: weights.shipping * 100 })
    }

    if (parsedCriteria.waterproof !== undefined) {
      relevantCriteria.push({ key: "waterproof", label: "Waterproof", weight: weights.waterproof * 100 })
    }

    if (parsedCriteria.weight_oz !== undefined || parsedCriteria.light !== undefined) {
      relevantCriteria.push({ key: "weight", label: "Weight", weight: weights.weight * 100 })
    }

    if (parsedCriteria.width !== undefined) {
      relevantCriteria.push({ key: "width", label: "Width", weight: weights.width * 100 })
    }

    if (parsedCriteria.brand_prefer !== undefined || parsedCriteria.brand_avoid !== undefined) {
      relevantCriteria.push({ key: "brand", label: "Brand", weight: weights.brand * 100 })
    }

    if (parsedCriteria.cushion !== undefined) {
      relevantCriteria.push({ key: "cushion", label: "Cushion", weight: weights.cushion * 100 })
    }

    return relevantCriteria
  }

  const renderProductCard = (result: ScoredProduct, index: number) => (
    <motion.div
      key={result.product.id}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className={viewMode === "carousel" ? "flex-shrink-0 w-full" : ""}
    >
      <Card className="overflow-hidden h-full">
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Product Info */}
            <div className="flex-1">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                    {result.product.brand} {result.product.name}
                  </h3>
                  <div className="flex items-center gap-4 mt-2 text-sm text-slate-600 dark:text-slate-400">
                    <span className="font-medium text-lg text-slate-900 dark:text-slate-100">
                      ${result.product.price.toFixed(2)}
                    </span>
                    <div className="flex items-center gap-1">
                      <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                      <span>{result.product.rating}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Package className="w-4 h-4" />
                      <span>{result.product.weight_oz}oz</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      <span>{result.product.ship_days} days</span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                    {Math.round(result.overallScore * 100)}%
                  </div>
                  <div className="text-sm text-slate-500 dark:text-slate-400">Match</div>
                </div>
              </div>

              {/* Key specs */}
              <div className="flex flex-wrap gap-2 mb-4">
                <Badge variant={result.product.waterproof ? "default" : "secondary"}>
                  {result.product.waterproof ? "Waterproof" : "Not Waterproof"}
                </Badge>
                <Badge variant="outline">{result.product.width} width</Badge>
                <Badge variant="outline">{result.product.cushion} cushion</Badge>
                <Badge variant="outline">{result.product.drop_mm}mm drop</Badge>
              </div>

              {/* Criterion scores */}
              <div className="space-y-2">
                {result.criterionScores.map((criterion, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <div className="w-20 text-sm font-medium text-slate-600 dark:text-slate-400">{criterion.name}</div>
                    <div className="flex-1">
                      <Progress value={criterion.score * 100} className="h-2" />
                    </div>
                    <div className="w-12 text-sm font-medium text-right">{Math.round(criterion.score * 100)}%</div>
                    <div className="w-48 text-sm text-slate-600 dark:text-slate-400 truncate">{criterion.reason}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Product Image */}
            <div className="flex-shrink-0">
              <img
                src={result.product.image || "/placeholder.svg"}
                alt={`${result.product.brand} ${result.product.name}`}
                className="w-32 h-32 lg:w-40 lg:h-40 object-cover rounded-lg border border-slate-200 dark:border-slate-700"
              />
            </div>
          </div>

          {/* Expandable explanation */}
          <Collapsible>
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="mt-4 w-full justify-between"
                onClick={() => toggleProductExpansion(result.product.id)}
              >
                <span>Why this ranking?</span>
                {expandedProducts.has(result.product.id) ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-4 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
              <div className="space-y-2 text-sm">
                <p className="font-medium">Weighted Score Calculation:</p>
                {result.criterionScores.map((criterion, idx) => (
                  <div key={idx} className="flex justify-between">
                    <span>
                      {criterion.name} (weight: {Math.round(criterion.weight * 100)}%)
                    </span>
                    <span>
                      {Math.round(criterion.score * 100)}% × {Math.round(criterion.weight * 100)}% ={" "}
                      {Math.round(criterion.score * criterion.weight * 100)}%
                    </span>
                  </div>
                ))}
                <div className="border-t pt-2 font-medium">
                  <div className="flex justify-between">
                    <span>Total Score:</span>
                    <span>{Math.round(result.overallScore * 100)}%</span>
                  </div>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </CardContent>
      </Card>
    </motion.div>
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-slate-900 dark:text-slate-100 mb-2">Product Match Finder</h1>
          <p className="text-slate-600 dark:text-slate-400">
            Describe what you need in natural language and find your perfect match
          </p>
        </div>

        {/* Two-column layout with left rail for criteria */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left Rail - Criteria (only show after search) */}
          {hasSearched && (
            <div className="lg:col-span-1">
              <Card className="sticky top-4">
                <CardHeader>
                  <CardTitle className="text-lg">Criteria Weights</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {getRelevantCriteria(criteria).map(({ key, label, weight }) => (
                      <div key={key} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-600 dark:text-slate-400">{label}</span>
                          <span className="font-medium">{Math.round(weight)}%</span>
                        </div>
                        <Slider
                          value={[weight]}
                          onValueChange={([value]) => updateCriteriaWeight(key, value)}
                          max={100}
                          step={5}
                          className="w-full"
                        />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Main Content */}
          <div className={hasSearched ? "lg:col-span-3" : "lg:col-span-4"}>
            {/* Search Input with inline suggestions */}
            <Card className="mb-6">
              <CardContent className="p-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Search Section */}
                  <div className={results.length > 0 ? "lg:col-span-2" : "lg:col-span-3"}>
                    <div className="space-y-4">
                      <Textarea
                        placeholder="e.g., I need women's trail running shoes under $120, waterproof, light, for wide feet, deliver in 3 days."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        className="min-h-[100px] text-base"
                      />

                      <div className="flex flex-wrap gap-2 mb-4">
                        {EXAMPLE_PROMPTS.map((prompt, index) => (
                          <Button
                            key={index}
                            variant="outline"
                            size="sm"
                            onClick={() => setQuery(prompt)}
                            className="text-xs"
                          >
                            Example {index + 1}
                          </Button>
                        ))}
                      </div>

                      <Button onClick={handleSearch} disabled={!query.trim()} className="w-full sm:w-auto" size="lg">
                        <Search className="w-4 h-4 mr-2" />
                        Find Matches
                      </Button>
                    </div>
                  </div>

                  {results.length > 0 && (
                    <div className="lg:col-span-1">
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <Package className="w-4 h-4 text-green-500" />
                          <h3 className="font-medium text-sm">Also Consider</h3>
                        </div>
                        <div className="space-y-2">
                          {CRITERIA_SUGGESTIONS.map((suggestion, idx) => (
                            <div key={idx} className="text-xs">
                              <div className="font-medium text-slate-700 dark:text-slate-300">{suggestion.name}</div>
                              <div className="text-slate-500 dark:text-slate-400 text-xs">{suggestion.description}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <AnimatePresence>
              {hasSearched && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="space-y-6"
                >
                  {/* Summary */}
                  {summary && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Zap className="w-5 h-5 text-blue-500" />
                          Summary
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-slate-700 dark:text-slate-300 leading-relaxed">{summary}</p>
                      </CardContent>
                    </Card>
                  )}

                  {/* Results */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                        Ranked Results ({results.length} products)
                      </h2>
                      {results.length > 0 && (
                        <Select value={viewMode} onValueChange={(value: "grid" | "carousel") => setViewMode(value)}>
                          <SelectTrigger className="w-40">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="grid">
                              <div className="flex items-center gap-2">
                                <Grid3X3 className="w-4 h-4" />
                                Grid View
                              </div>
                            </SelectItem>
                            <SelectItem value="carousel">
                              <div className="flex items-center gap-2">
                                <RotateCcw className="w-4 h-4" />
                                Carousel View
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </div>

                    {results.length === 0 ? (
                      <Card>
                        <CardContent className="p-8 text-center">
                          <p className="text-slate-500 dark:text-slate-400">
                            No products found matching your criteria. Try adjusting your requirements.
                          </p>
                        </CardContent>
                      </Card>
                    ) : viewMode === "grid" ? (
                      <div className="grid gap-4">
                        {results.map((result, index) => renderProductCard(result, index))}
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={prevCarouselPage}
                              disabled={carouselIndex === 0}
                            >
                              <ChevronLeft className="w-4 h-4" />
                            </Button>
                            <span className="text-sm text-slate-600 dark:text-slate-400">
                              Page {carouselIndex + 1} of {Math.ceil(results.length / 2)}
                            </span>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={nextCarouselPage}
                              disabled={carouselIndex >= Math.ceil(results.length / 2) - 1}
                            >
                              <ChevronRight className="w-4 h-4" />
                            </Button>
                          </div>
                          <div className="text-sm text-slate-600 dark:text-slate-400">
                            Showing {carouselIndex * 2 + 1}-{Math.min((carouselIndex + 1) * 2, results.length)} of{" "}
                            {results.length}
                          </div>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                          {results
                            .slice(carouselIndex * 2, (carouselIndex + 1) * 2)
                            .map((result, index) => renderProductCard(result, index))}
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* No criteria state */}
            {!hasSearched && (
              <Card className="text-center py-12">
                <CardContent>
                  <Search className="w-16 h-16 text-slate-400 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    Ready to find your perfect product?
                  </h3>
                  <p className="text-slate-500 dark:text-slate-400 mb-4">
                    Describe what you're looking for in natural language and we'll find the best matches.
                  </p>
                  <div className="text-sm text-slate-400 dark:text-slate-500">
                    Try clicking one of the example prompts above to get started!
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
