"use client"

import { useEffect, useMemo, useState } from "react"
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
  Loader2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
// import { Progress } from "@/components/ui/progress"
import { Slider } from "@/components/ui/slider"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

// Types
import type { Product, ParsedCriteria, ScoredProduct } from "@/lib/types"
type RankedItem = { product: Product; overall: number; reason: string }

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

// Import pure engine functions
import { parseCriteria, rankProducts as rankProductsForCatalog, buildSummary } from "@/lib/engine"

// Wrapper to rank current catalog
function rankProducts(criteria: ParsedCriteria, weights: Record<string, number>): ScoredProduct[] {
  return rankProductsForCatalog(CATALOG, criteria, weights) as ScoredProduct[]
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
  const [results, setResults] = useState<RankedItem[]>([])
  const [summary, setSummary] = useState("")
  const [hasSearched, setHasSearched] = useState(false)
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set())
  const [viewMode, setViewMode] = useState<"grid" | "carousel">("grid")
  const [carouselIndex, setCarouselIndex] = useState(0)
  const [loading, setLoading] = useState(false)
  const [fallback, setFallback] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [explanation, setExplanation] = useState<{
    overview: string
    perItem?: { id: string; label: 'Best deal' | 'Also good' | 'Fastest arrival' | 'Highest rated' | 'Lowest price'; oneLiner: string }[]
    caveats?: string[]
  } | null>(null)

  // Catalog map for rendering details from API ids
  const [catalog, setCatalog] = useState<Product[] | null>(null)
  const productMap = useMemo(() => {
    const map = new Map<string, Product>()
    ;(catalog || CATALOG).forEach((p) => map.set(p.id, p))
    return map
  }, [catalog])

  useEffect(() => {
    const adapt = (p: any): Product => ({
      id: p.id,
      name: p.title ?? p.name ?? "",
      brand: p.brand,
      price: p.price,
      rating: p.rating,
      ship_days: p.shipDays ?? p.ship_days ?? 0,
      image: (typeof p.image === "string" && !p.image.startsWith("/images/")) ? p.image : "/placeholder.svg",
      // best-effort defaults for legacy UI fields
      weight_oz: p.features?.weight_oz ?? undefined,
      waterproof: Boolean(p.features?.waterproof ?? p.waterproof ?? false),
      width: (p.width ?? "regular") as any,
      cushion: (p.cushion ?? "mid") as any,
      drop_mm: p.drop_mm ?? 0,
    })
    const load = async () => {
      try {
        const res = await fetch("/api/catalog", { cache: "no-store" })
        if (res.ok) {
          const data = await res.json()
          const adapted: Product[] = (data.products || []).map(adapt)
          setCatalog(adapted)
        }
      } catch {}
    }
    load()
  }, [])

  const handleSearch = async () => {
    setLoading(true)
    setError(null)
    setFallback(false)
    setHasSearched(true)
    setCarouselIndex(0)
    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query, weights: {
          price: weights.price ?? 0.3,
          shipping: weights.shipping ?? 0.2,
          features: 0.2,
          brand: 0.1,
          rating: 0.2,
        }, topK: 60 }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data?.fallback && Array.isArray(data.items)) {
          setFallback(true)
          setExplanation(null)
          const mapped = data.items
            .map((it: any) => ({ product: productMap.get(it.id), overall: 0, reason: "fallback" }))
            .filter((r: any) => !!r.product)
          setResults(mapped)
        } else {
          setError("Search failed")
        }
        return
      }
      const ranked: RankedItem[] = data.items
        .map((it: any) => ({ product: productMap.get(it.id), overall: it.overall, reason: it.reason }))
        .filter((r: any) => !!r.product)
      setResults(ranked)
      setSummary("")
      setExplanation(data.explanation ?? null)
    } catch {
      setError("Network error")
    } finally {
      setLoading(false)
    }
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

  const renderProductCard = (result: any, index: number) => (
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
                    {result.product.weight_oz !== undefined && (
                      <div className="flex items-center gap-1">
                        <Package className="w-4 h-4" />
                        <span>{result.product.weight_oz}oz</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      <span>{result.product.ship_days} days</span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">{Math.round((result as any).overall ? (result as any).overall * 100 : (result as any).overallScore * 100)}%</div>
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

              {/* Reason from judge */}
              <div className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                Reason: <span className="italic">{(result as any).reason || "—"}</span>
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
                aria-expanded={expandedProducts.has(result.product.id)}
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
                <p className="font-medium">Explanation:</p>
                <p className="text-slate-600 dark:text-slate-400">{(result as any).reason || "No additional details."}</p>
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
                  {fallback && (
                    <Card role="status" aria-live="polite">
                      <CardContent className="p-4 text-sm text-amber-700 bg-amber-50">
                        Showing unranked fallback
                      </CardContent>
                    </Card>
                  )}
                  {/* Summary */}
                  {explanation && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Zap className="w-5 h-5 text-blue-500" />
                          Summary
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-slate-700 dark:text-slate-300 leading-relaxed">{explanation.overview}</p>
                        {explanation.perItem && explanation.perItem.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {explanation.perItem.map((pi, i) => (
                              <div key={pi.id} className="border rounded-md px-3 py-2 text-sm bg-white dark:bg-slate-900">
                                <div className="font-medium">{pi.label}</div>
                                <div className="text-slate-600 dark:text-slate-400">{pi.oneLiner}</div>
                              </div>
                            ))}
                          </div>
                        )}
                        {explanation.caveats && explanation.caveats.length > 0 && (
                          <ul className="mt-3 list-disc list-inside text-sm text-slate-600 dark:text-slate-400">
                            {explanation.caveats.map((c, i) => (
                              <li key={i}>{c}</li>
                            ))}
                          </ul>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {/* Results */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                        Ranked Results ({results.length} products)
                      </h2>
                      {loading && (
                        <div className="flex items-center gap-2 text-sm text-slate-500" role="status" aria-live="polite">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Searching...
                        </div>
                      )}
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
