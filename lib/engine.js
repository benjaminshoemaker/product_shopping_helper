// Pure matching engine in plain JS so it can be tested with node:test

/**
 * Parse a natural-language query into structured criteria.
 * @param {string} text
 * @returns {object}
 */
export function parseCriteria(text) {
  const criteria = {}
  const lowerText = (text || '').toLowerCase()

  // Price cap
  const priceMatch = lowerText.match(/(?:under|<|below|max)\s*\$?(\d+(?:\.\d{2})?)/i)
  if (priceMatch) criteria.price_cap = Number.parseFloat(priceMatch[1])

  // Delivery days
  const daysMatch = lowerText.match(/(?:in|within)\s*(\d+)\s*days?/i)
  if (daysMatch) criteria.ship_days = Number.parseInt(daysMatch[1])

  // Waterproof
  if (lowerText.includes('waterproof') || lowerText.includes('gtx') || lowerText.includes('gore-tex')) {
    criteria.waterproof = true
  }

  // Weight
  const weightMatch = lowerText.match(/(?:under|<|below)\s*(\d+(?:\.\d+)?)\s*oz/i)
  if (weightMatch) criteria.weight_oz = Number.parseFloat(weightMatch[1])
  if (lowerText.includes('light') || lowerText.includes('ultralight')) criteria.light = true

  // Width
  if (lowerText.includes('wide feet') || lowerText.includes('wide width')) criteria.width = 'wide'
  else if (lowerText.includes('narrow')) criteria.width = 'narrow'

  // Brand preferences
  const brands = ['nike', 'hoka', 'adidas', 'brooks', 'altra', 'saucony']
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
  if (lowerText.includes('high cushion') || lowerText.includes('max cushion')) criteria.cushion = 'high'
  else if (lowerText.includes('low cushion') || lowerText.includes('minimal cushion')) criteria.cushion = 'low'
  else if (lowerText.includes('mid cushion') || lowerText.includes('medium cushion')) criteria.cushion = 'mid'

  return criteria
}

/**
 * Score a single product against parsed criteria with weights.
 * @param {object} product
 * @param {object} criteria
 * @param {Record<string, number>} weights
 */
export function scoreProduct(product, criteria, weights) {
  const criterionScores = []
  let totalWeightedScore = 0
  let totalWeight = 0

  // Price
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
      name: 'Price', weight, enabled: true, score, reason,
      target: criteria.price_cap ? `≤$${criteria.price_cap}` : 'Any', actual: `$${product.price.toFixed(2)}`,
    })
    totalWeightedScore += weight * score
    totalWeight += weight
  }

  // Shipping
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
      name: 'Shipping', weight, enabled: true, score, reason,
      target: `≤${criteria.ship_days} days`, actual: `${product.ship_days} days`,
    })
    totalWeightedScore += weight * score
    totalWeight += weight
  }

  // Waterproof
  if (criteria.waterproof !== undefined) {
    const weight = weights.waterproof || 0.25
    const score = product.waterproof === criteria.waterproof ? 1 : 0
    const reason = criteria.waterproof
      ? (product.waterproof ? 'Waterproof ✓' : 'Not waterproof ✗')
      : (product.waterproof ? 'Waterproof (bonus)' : 'Not waterproof (as requested)')
    criterionScores.push({
      name: 'Waterproof', weight, enabled: true, score, reason,
      target: criteria.waterproof ? 'Yes' : 'No', actual: product.waterproof ? 'Yes' : 'No',
    })
    totalWeightedScore += weight * score
    totalWeight += weight
  }

  // Weight / Light
  if (criteria.weight_oz !== undefined || criteria.light) {
    const weight = weights.weight || 0.15
    let score = 1
    let reason = `${product.weight_oz}oz`
    if (criteria.weight_oz) {
      score = product.weight_oz <= criteria.weight_oz
        ? Math.max(0.8, 1 - (product.weight_oz / criteria.weight_oz) * 0.2)
        : Math.max(0.2, 1 - (product.weight_oz - criteria.weight_oz) / 5)
      reason = `Target ≤${criteria.weight_oz}oz, this is ${product.weight_oz}oz → ${Math.round(score * 100)}%`
    } else if (criteria.light) {
      score = product.weight_oz <= 10
        ? Math.max(0.7, 1 - (product.weight_oz / 10) * 0.3)
        : Math.max(0.2, 1 - (product.weight_oz - 10) / 5)
      reason = `Light weight: ${product.weight_oz}oz → ${Math.round(score * 100)}%`
    }
    criterionScores.push({ name: 'Weight', weight, enabled: true, score, reason,
      target: criteria.weight_oz ? `≤${criteria.weight_oz}oz` : 'Light', actual: `${product.weight_oz}oz`,
    })
    totalWeightedScore += weight * score
    totalWeight += weight
  }

  // Width
  if (criteria.width) {
    const weight = weights.width || 0.2
    let score = 0
    let reason = ''
    if (product.width === criteria.width) {
      score = 1
      reason = `Perfect width match: ${criteria.width}`
    } else if (criteria.width === 'wide' && product.width === 'regular') {
      score = 0.5
      reason = 'Regular width (acceptable for wide feet)'
    } else {
      score = 0.1
      reason = `Width mismatch: ${product.width} vs ${criteria.width}`
    }
    criterionScores.push({ name: 'Width', weight, enabled: true, score, reason,
      target: criteria.width, actual: product.width,
    })
    totalWeightedScore += weight * score
    totalWeight += weight
  }

  // Brand
  if ((criteria.brand_prefer && criteria.brand_prefer.length) || (criteria.brand_avoid && criteria.brand_avoid.length)) {
    const weight = weights.brand || 0.1
    let score = 0.5
    let reason = 'Neutral brand'
    if (criteria.brand_prefer && criteria.brand_prefer.includes(String(product.brand).toLowerCase())) {
      score = 1
      reason = `Preferred brand: ${product.brand}`
    } else if (criteria.brand_avoid && criteria.brand_avoid.includes(String(product.brand).toLowerCase())) {
      score = 0.1
      reason = `Avoided brand: ${product.brand}`
    }
    criterionScores.push({ name: 'Brand', weight, enabled: true, score, reason,
      target: (criteria.brand_prefer && criteria.brand_prefer.join(', ')) || 'Any', actual: product.brand,
    })
    totalWeightedScore += weight * score
    totalWeight += weight
  }

  // Cushion
  if (criteria.cushion) {
    const weight = weights.cushion || 0.15
    let score = 0
    let reason = ''
    if (product.cushion === criteria.cushion) {
      score = 1
      reason = `Perfect cushion match: ${criteria.cushion}`
    } else {
      const order = ['low', 'mid', 'high']
      const targetIndex = order.indexOf(criteria.cushion)
      const actualIndex = order.indexOf(product.cushion)
      const diff = Math.abs(targetIndex - actualIndex)
      if (diff === 1) { score = 0.6; reason = `Adjacent cushion level: ${product.cushion} vs ${criteria.cushion}` }
      else { score = 0.2; reason = `Different cushion: ${product.cushion} vs ${criteria.cushion}` }
    }
    criterionScores.push({ name: 'Cushion', weight, enabled: true, score, reason,
      target: criteria.cushion, actual: product.cushion,
    })
    totalWeightedScore += weight * score
    totalWeight += weight
  }

  // Fallback: rating
  if (totalWeight === 0) {
    const weight = 1
    const score = (product.rating || 0) / 5
    criterionScores.push({ name: 'Rating', weight, enabled: true, score, reason: `${product.rating}/5 stars`, target: 'High rating', actual: `${product.rating}/5` })
    totalWeightedScore = score
    totalWeight = weight
  }

  const overallScore = totalWeight > 0 ? totalWeightedScore / totalWeight : 0
  return { product, overallScore, criterionScores }
}

/**
 * Rank products for a given catalog.
 * @param {Array<object>} catalog
 * @param {object} criteria
 * @param {Record<string, number>} weights
 */
export function rankProducts(catalog, criteria, weights) {
  return (catalog || [])
    .map((product) => scoreProduct(product, criteria, weights))
    .sort((a, b) => b.overallScore - a.overallScore)
}

/**
 * Build a natural language summary of ranked products.
 * @param {object} criteria
 * @param {Array<object>} rankedProducts
 */
export function buildSummary(criteria, rankedProducts) {
  const sentences = []
  if (rankedProducts.length > 1) {
    const winner = rankedProducts[0]
    const runnerUp = rankedProducts[1]
    const scoreDiff = Math.round((winner.overallScore - runnerUp.overallScore) * 100)
    const strongestCriterion = winner.criterionScores.reduce((best, current) =>
      current.score * current.weight > best.score * best.weight ? current : best,
    )
    const winnerAdvantages = winner.criterionScores
      .filter((c) => c.score > 0.8)
      .sort((a, b) => b.score * b.weight - a.score * a.weight)
      .slice(0, 2)
    sentences.push(
      `${winner.product.brand} ${winner.product.name} ($${winner.product.price.toFixed(2)}) ranks #1 with a ${Math.round(winner.overallScore * 100)}% match, excelling in ${winnerAdvantages.map((a) => a.name.toLowerCase()).join(' and ')}.`,
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
    const withinBudget = rankedProducts.filter((p) => p.product.price <= criteria.price_cap)
    const budgetRanked = withinBudget.slice(0, 3)
    if (budgetRanked.length > 0) {
      const budgetLeader = budgetRanked[0]
      sentences.push(
        `Within your $${criteria.price_cap} budget: ${budgetRanked.length} options available, led by ${budgetLeader.product.brand} ${budgetLeader.product.name} at $${budgetLeader.product.price.toFixed(2)}.`,
      )
      if (rankedProducts[0] && rankedProducts[0].product.price > criteria.price_cap) {
        sentences.push(
          `While ${rankedProducts[0].product.brand} ${rankedProducts[0].product.name} scores highest overall, it exceeds your budget at $${rankedProducts[0].product.price.toFixed(2)}.`,
        )
      }
    } else if (rankedProducts.length > 0) {
      sentences.push(
        `No products found within your $${criteria.price_cap} budget - consider increasing to $${Math.min(...rankedProducts.map((p) => p.product.price)).toFixed(2)} for the most affordable option.`,
      )
    }
  } else if (rankedProducts.length > 1) {
    const prices = rankedProducts.map((p) => p.product.price)
    const min = Math.min(...prices)
    const max = Math.max(...prices)
    const cheapest = rankedProducts.find((p) => p.product.price === min)
    const mostExpensive = rankedProducts.find((p) => p.product.price === max)
    if (cheapest && mostExpensive) {
      sentences.push(
        `Price range spans $${min.toFixed(2)} (${cheapest.product.brand} ${cheapest.product.name}) to $${max.toFixed(2)} (${mostExpensive.product.brand} ${mostExpensive.product.name}).`,
      )
    }
  }

  if (rankedProducts.length > 1) {
    const bestValue = rankedProducts.reduce((best, current) => {
      const valueScore = current.overallScore / (current.product.price / 100)
      const bestValueScore = best.overallScore / (best.product.price / 100)
      return valueScore > bestValueScore ? current : best
    })
    if (bestValue.product.id !== rankedProducts[0].product.id) {
      sentences.push(
        `Best value proposition: ${bestValue.product.brand} ${bestValue.product.name} delivers ${Math.round(bestValue.overallScore * 100)}% match at just $${bestValue.product.price.toFixed(2)}, offering excellent performance per dollar.`,
      )
    }
    const premiumCandidates = rankedProducts.filter((p) => p.product.price > rankedProducts[0].product.price * 1.2)
    if (premiumCandidates.length > 0 && premiumCandidates[0].overallScore > rankedProducts[0].overallScore) {
      const premium = premiumCandidates[0]
      const priceDiff = premium.product.price - rankedProducts[0].product.price
      sentences.push(
        `Premium option: ${premium.product.brand} ${premium.product.name} costs $${priceDiff.toFixed(2)} more but offers ${Math.round((premium.overallScore - rankedProducts[0].overallScore) * 100)} additional match points.`,
      )
    }
  }

  return sentences.join(' ')
}

