// Unit conversion logic
import { unitConversions, variables } from './constants'
import { SCALED_NUM_RE, applyScale } from './scales'
import { evaluateMath } from './math'

// Build a set of all known single-word unit keys for spaceless normalization.
// Multi-word units (e.g., "miles per gallon", "sq ft") are excluded since they
// can't appear glued to a number without a space.
const _buildUnitSet = () => {
  const units = new Set()
  for (const [_category, map] of Object.entries(unitConversions)) {
    for (const key of Object.keys(map)) {
      // Only single-word keys (no spaces, no slashes)
      if (/^[a-zA-Z_°]+$/.test(key)) {
        units.add(key.toLowerCase())
      }
    }
  }
  return units
}
const KNOWN_UNITS_LOWER = _buildUnitSet()

// Single-letter units that are safe to normalize (won't conflict with scales/hex/etc.)
// Excluded: k (scale), M (scale), c (too ambiguous), f (too ambiguous), e (Euler's number)
const SAFE_SINGLE_CHAR_UNITS = new Set(['l', 'g', 's', 'h', 'm'])

// Case-sensitive units that must match exactly (data units like KB, MB, GB, etc.)
const CASE_SENSITIVE_UNITS = new Set()
for (const key of Object.keys(unitConversions.data)) {
  if (/^[A-Z][a-zA-Z]+$/.test(key)) CASE_SENSITIVE_UNITS.add(key)
}

// Insert a space between a number and a glued unit suffix.
// "100km" → "100 km", "5kg" → "5 kg", "60mph" → "60 mph"
// Preserves hex/bin/oct literals (0xFF, 0b1010, 0o777), scale suffixes (2k, 3M),
// and compound unit names like l/100km.
export const normalizeUnitSpacing = (input) => {
  // First, protect l/100km-style patterns from being split
  // Replace them with placeholders, normalize, then restore
  const protectedPatterns = []
  let protected_ = input.replace(/\b([a-zA-Z]+\/\d+[a-zA-Z]+)\b/g, (match) => {
    const idx = protectedPatterns.length
    protectedPatterns.push(match)
    return `__PROTECTED_${idx}__`
  })

  // Match digit(s) immediately followed by letters (no space between)
  protected_ = protected_.replace(/(\d)([a-zA-Z])/g, (match, digit, letter, offset) => {
    // Don't touch hex/bin/oct prefixes: 0x, 0b, 0o
    if (digit === '0' && (letter === 'x' || letter === 'b' || letter === 'o')) {
      return match
    }
    // Extract the full letter sequence following this position
    const rest = protected_.slice(offset + 1) // everything from the letter onward
    const wordMatch = rest.match(/^([a-zA-Z_°][a-zA-Z0-9_°]*)/)
    if (!wordMatch) return match

    const candidate = wordMatch[1]

    // Skip single-letter candidates that conflict with scale suffixes (k, K, M)
    if (candidate === 'k' || candidate === 'K' || candidate === 'M') {
      return match
    }

    // Check case-sensitive data units first (GB, MB, KB, TB, etc.)
    if (CASE_SENSITIVE_UNITS.has(candidate)) {
      return digit + ' ' + letter
    }

    // For single-character candidates, only normalize safe ones (case-sensitive)
    if (candidate.length === 1) {
      if (SAFE_SINGLE_CHAR_UNITS.has(candidate)) {
        return digit + ' ' + letter
      }
      return match
    }

    // Check if the candidate (lowercase) is a known unit (2+ chars)
    if (KNOWN_UNITS_LOWER.has(candidate.toLowerCase())) {
      return digit + ' ' + letter
    }

    return match
  })

  // Restore protected patterns, inserting a space if a digit precedes the pattern
  for (let i = 0; i < protectedPatterns.length; i++) {
    protected_ = protected_.replace(
      new RegExp(`(\\d)__PROTECTED_${i}__|__PROTECTED_${i}__`),
      (match, digit) => (digit ? digit + ' ' + protectedPatterns[i] : protectedPatterns[i]),
    )
  }

  return protected_
}

export const findUnitCategory = (unitName) => {
  const lower = unitName.toLowerCase()

  // Check for fuel economy compound units first (before "per" gets misinterpreted)
  // Match patterns like "miles per gallon", "km per litre", "l/100km", "mpg", etc.
  if (unitConversions.fueleconomy[lower] !== undefined) {
    return { category: 'fueleconomy', unit: lower, factor: unitConversions.fueleconomy[lower] }
  }

  // Check for square/cubic prefixes first
  const sqMatch = lower.match(/^(sq|square)\s+(.+)$/)
  if (sqMatch) {
    const baseUnit = sqMatch[2]
    const areaKey = `square ${baseUnit}`
    const sqKey = `sq ${baseUnit}`
    if (unitConversions.area[areaKey])
      return { category: 'area', unit: areaKey, factor: unitConversions.area[areaKey] }
    if (unitConversions.area[sqKey])
      return { category: 'area', unit: sqKey, factor: unitConversions.area[sqKey] }
    // Try to derive from length
    const lengthFactor = unitConversions.length[baseUnit]
    if (lengthFactor !== undefined) {
      return { category: 'area', unit: sqKey, factor: lengthFactor * lengthFactor }
    }
  }

  const cuMatch = lower.match(/^(cu|cubic)\s+(.+)$/)
  if (cuMatch) {
    const baseUnit = cuMatch[2]
    const cuKey = `cu ${baseUnit}`
    const cubicKey = `cubic ${baseUnit}`
    if (unitConversions.volume[cuKey])
      return { category: 'volume', unit: cuKey, factor: unitConversions.volume[cuKey] }
    if (unitConversions.volume[cubicKey])
      return { category: 'volume', unit: cubicKey, factor: unitConversions.volume[cubicKey] }
    // Derive from length
    const lengthFactor = unitConversions.length[baseUnit]
    if (lengthFactor !== undefined) {
      return {
        category: 'volume',
        unit: cuKey,
        factor: lengthFactor * lengthFactor * lengthFactor * 1000,
      }
    }
  }

  // Check cbm (cubic meter)
  if (lower === 'cbm') return { category: 'volume', unit: 'cbm', factor: 1000 }

  // Check multi-word units first (square inches, cubic meters, etc.)
  for (const [category, units] of Object.entries(unitConversions)) {
    if (category === 'temperature') continue
    if (units[lower] !== undefined) return { category, unit: lower, factor: units[lower] }
  }

  // Case-sensitive check for data units (KB, MB, GB, etc.)
  if (unitConversions.data[unitName] !== undefined) {
    return { category: 'data', unit: unitName, factor: unitConversions.data[unitName] }
  }

  return null
}

export const convertTemperature = (value, fromUnit, toUnit) => {
  const from = unitConversions.temperature[fromUnit.toLowerCase()]
  const to = unitConversions.temperature[toUnit.toLowerCase()]
  if (!from || !to) return null

  // Convert to Celsius first
  let celsius
  if (from === 'C') celsius = value
  else if (from === 'F') celsius = ((value - 32) * 5) / 9
  else if (from === 'K') celsius = value - 273.15

  // Convert from Celsius to target
  if (to === 'C') return celsius
  if (to === 'F') return (celsius * 9) / 5 + 32
  if (to === 'K') return celsius + 273.15
}

// Fuel economy conversion: base unit is kpl (km per litre)
// l/100km is inverse: l/100km = 100 / kpl, kpl = 100 / (l/100km)
export const convertFuelEconomy = (value, fromUnit, toUnit) => {
  const fromFactor = unitConversions.fueleconomy[fromUnit.toLowerCase()]
  const toFactor = unitConversions.fueleconomy[toUnit.toLowerCase()]
  if (fromFactor === undefined || toFactor === undefined) return null

  const isFromInverse = fromFactor === -1 // l/100km
  const isToInverse = toFactor === -1 // l/100km

  // Convert source value to kpl (base)
  let kpl
  if (isFromInverse) {
    // l/100km → kpl: kpl = 100 / value
    kpl = 100 / value
  } else {
    // Normal unit → kpl: kpl = value * factor
    kpl = value * fromFactor
  }

  // Convert kpl to target
  if (isToInverse) {
    // kpl → l/100km: l/100km = 100 / kpl
    return 100 / kpl
  } else {
    // kpl → normal unit: value = kpl / factor
    return kpl / toFactor
  }
}

// Parse a unit expression that may contain arithmetic (e.g., "1 km + 500 m")
// Returns value in base unit of the given category, or null
export const parseUnitExpression = (expr, category) => {
  // Normalize spacing: "100km" → "100 km"
  const normalized = normalizeUnitSpacing(expr)

  // Try compound units first: "1 meter 20 cm"
  const compoundPattern =
    /(\d+(?:\.\d+)?)\s+([\w]+(?:\s+[\w]+)?)\s+(\d+(?:\.\d+)?)\s+([\w]+(?:\s+[\w]+)?)/i
  const compoundMatch = normalized.match(compoundPattern)
  if (compoundMatch) {
    const val1 = parseFloat(compoundMatch[1])
    const unit1 = compoundMatch[2].trim()
    const val2 = parseFloat(compoundMatch[3])
    const unit2 = compoundMatch[4].trim()
    const info1 = findUnitCategory(unit1)
    const info2 = findUnitCategory(unit2)
    if (info1 && info2 && info1.category === category && info2.category === category) {
      return val1 * info1.factor + val2 * info2.factor
    }
  }

  // Try simple "N unit" first (with optional scale: "2k km", "1.5M meters")
  const simpleRe = new RegExp(`^${SCALED_NUM_RE}\\s+(.+)$`)
  const simpleMatch = normalized.match(simpleRe)
  if (simpleMatch) {
    const value = applyScale(simpleMatch[1], simpleMatch[2])
    const unitStr = simpleMatch[3].trim()
    const unitInfo = findUnitCategory(unitStr)
    if (unitInfo && unitInfo.category === category) {
      return value * unitInfo.factor
    }
  }

  // Try extracting a unit from expressions with multiplication, division, or parentheses.
  // Handles cases like "(20 cm * 4 + 5%)", "20 cm * 4", "(10 kg * 3)"
  if (/[*/()]/.test(normalized) || (/[+-]/.test(normalized) && /[()]/.test(normalized))) {
    const unitCandidatePattern = /\b([a-zA-Z][a-zA-Z\s]*[a-zA-Z]|[a-zA-Z])\b/g
    let unitMatch
    let foundUnit = null
    let foundInfo = null
    while ((unitMatch = unitCandidatePattern.exec(normalized)) !== null) {
      const candidate = unitMatch[1].trim()
      const info = findUnitCategory(candidate)
      if (info && info.category === category) {
        if (!foundUnit || candidate.length > foundUnit.length) {
          foundUnit = candidate
          foundInfo = info
        }
      }
    }
    if (foundUnit && foundInfo) {
      const escaped = foundUnit
        .split('')
        .map((ch) => {
          if ('.+*?^[]{}()|\\'.indexOf(ch) >= 0) return '\\' + ch
          return ch
        })
        .join('')
      const unitRe = new RegExp('\\b' + escaped + '\\b', 'gi')
      const stripped = normalized.replace(unitRe, '').trim()
      try {
        const value = evaluateMath(stripped)
        return value * foundInfo.factor
      } catch (_e) {
        /* fall through */
      }
    }
  }

  // Try arithmetic: "1 km + 500 m", "2 ft - 3 inches"
  const parts = normalized.split(/\s*([+-])\s*/)
  if (parts.length >= 3) {
    let total = null
    let op = '+'
    for (const part of parts) {
      if (part === '+' || part === '-') {
        op = part
        continue
      }
      const partRe = new RegExp(`^${SCALED_NUM_RE}\\s+(.+)$`)
      const m = part.trim().match(partRe)
      if (m) {
        const val = applyScale(m[1], m[2])
        const unitStr = m[3].trim()
        const unitInfo = findUnitCategory(unitStr)
        if (unitInfo && unitInfo.category === category) {
          const baseVal = val * unitInfo.factor
          if (total === null) total = baseVal
          else total = op === '+' ? total + baseVal : total - baseVal
        } else {
          return null
        }
      } else {
        try {
          const val = evaluateMath(part.trim())
          if (total === null) total = val
          else total = op === '+' ? total + val : total - val
        } catch (_e) {
          return null
        }
      }
    }
    return total
  }

  // Try evaluating as pure math  // Try evaluating as pure math
  try {
    return evaluateMath(expr)
  } catch (_e) {
    return null
  }
}

// Parse compound units like "1 meter 20 cm"
export const parseCompoundUnits = (input) => {
  const pattern = /(\d+(?:\.\d+)?)\s+([\w]+(?:\s+[\w]+)?)\s+(\d+(?:\.\d+)?)\s+([\w]+(?:\s+[\w]+)?)/i
  const match = input.match(pattern)
  if (!match) return null

  const val1 = parseFloat(match[1])
  const unit1 = match[2].trim()
  const val2 = parseFloat(match[3])
  const unit2 = match[4].trim()

  const info1 = findUnitCategory(unit1)
  const info2 = findUnitCategory(unit2)

  if (info1 && info2 && info1.category === info2.category) {
    const baseTotal = val1 * info1.factor + val2 * info2.factor
    const smallerFactor = Math.min(info1.factor, info2.factor)
    const smallerUnit = info1.factor < info2.factor ? unit1 : unit2
    const result = baseTotal / smallerFactor
    return { value: result, unit: smallerUnit, hasUnit: true, isConverted: true }
  }

  return null
}

// CSS bridge: convert between length units and CSS pixels using ppi
export const isCSSBridgeConversion = (sourceExpr, targetUnit) => {
  const cssUnits = ['px', 'pixel', 'pixels', 'pt', 'point', 'points', 'em', 'rem']
  const lengthUnits = Object.keys(unitConversions.length)
  const targetLower = targetUnit.toLowerCase()

  const normalizedSource = normalizeUnitSpacing(sourceExpr)
  const sourceUnit = normalizedSource
    .match(/\d+(?:\.\d+)?\s+(.+)/)?.[1]
    ?.trim()
    ?.toLowerCase()
  if (!sourceUnit) return false

  return (
    (cssUnits.includes(targetLower) && lengthUnits.includes(sourceUnit)) ||
    (lengthUnits.includes(targetLower) && cssUnits.includes(sourceUnit))
  )
}

export const handleCSSBridge = (sourceExpr, targetUnit) => {
  const ppi = variables.value._ppi || 96 // default 96 ppi
  const targetLower = targetUnit.toLowerCase()

  const normalizedSource = normalizeUnitSpacing(sourceExpr)
  const srcRe = new RegExp(`^${SCALED_NUM_RE}\\s+(.+)$`)
  const srcMatch = normalizedSource.match(srcRe)
  if (!srcMatch) return null

  const value = applyScale(srcMatch[1], srcMatch[2])
  const srcUnit = srcMatch[3].trim().toLowerCase()

  const lengthUnits = unitConversions.length
  const cssUnits = unitConversions.css

  if (
    lengthUnits[srcUnit] !== undefined &&
    (targetLower === 'px' || targetLower === 'pixel' || targetLower === 'pixels')
  ) {
    const inches = (value * lengthUnits[srcUnit]) / 0.0254
    const px = inches * ppi
    return { value: px, unit: targetUnit, hasUnit: true, isConverted: true }
  }

  if (cssUnits[srcUnit] !== undefined && cssUnits[targetLower] !== undefined) {
    const px = value * cssUnits[srcUnit]
    const result = px / cssUnits[targetLower]
    return { value: result, unit: targetUnit, hasUnit: true, isConverted: true }
  }

  return null
}

export const handleUnitExpression = (input) => {
  const noResult = { value: 0, unit: null, hasUnit: false, isConverted: false }

  // Normalize spacing: "100km" → "100 km", "60mph" → "60 mph"
  let normalized = normalizeUnitSpacing(input)

  // Normalize square/cubic prefixes in input
  normalized = normalized
    .replace(/\bsquare\s+/gi, 'square ')
    .replace(/\bcubic\s+/gi, 'cubic ')
    .replace(/\bsq\s+/gi, 'sq ')
    .replace(/\bcu\s+/gi, 'cu ')
    .replace(/(\d)°/g, '$1 °')

  // Check for "X unit in/to/as Y unit" pattern
  const convMatch = normalized.match(/^(.+?)\s+(?:in|to|as)\s+(.+)$/i)
  if (convMatch) {
    const sourceExpr = convMatch[1].trim()
    const targetUnitStr = convMatch[2].trim()

    const targetInfo = findUnitCategory(targetUnitStr)

    // Check if source is a variable with unit metadata (e.g., "mileage in kpl")
    const varName = sourceExpr.toLowerCase()
    for (const [vName, vVal] of Object.entries(variables.value)) {
      if (vName.toLowerCase() === varName && typeof vVal === 'object' && vVal.unit) {
        const srcUnitInfo = findUnitCategory(vVal.unit)
        if (srcUnitInfo) {
          // Fuel economy variable conversion
          if (
            srcUnitInfo.category === 'fueleconomy' &&
            unitConversions.fueleconomy[targetUnitStr.toLowerCase()] !== undefined
          ) {
            const result = convertFuelEconomy(vVal.value, vVal.unit, targetUnitStr)
            if (result !== null)
              return {
                value: result,
                unit: targetUnitStr,
                category: 'fueleconomy',
                hasUnit: true,
                isConverted: true,
              }
          }
          // Temperature variable conversion
          if (
            srcUnitInfo.category === 'temperature' &&
            unitConversions.temperature[targetUnitStr.toLowerCase()]
          ) {
            const result = convertTemperature(vVal.value, vVal.unit, targetUnitStr)
            if (result !== null)
              return {
                value: result,
                unit: targetUnitStr,
                category: 'temperature',
                hasUnit: true,
                isConverted: true,
              }
          }
          // General unit variable conversion (same category)
          if (targetInfo && targetInfo.category === srcUnitInfo.category) {
            const baseValue = vVal.value * srcUnitInfo.factor
            const result = baseValue / targetInfo.factor
            return {
              value: result,
              unit: targetUnitStr,
              category: targetInfo.category,
              hasUnit: true,
              isConverted: true,
            }
          }
        }
      }
    }

    // Temperature special case
    if (unitConversions.temperature[targetUnitStr.toLowerCase()]) {
      const srcTempRe = new RegExp(`^${SCALED_NUM_RE}\\s+(.+)$`)
      const srcMatch = sourceExpr.match(srcTempRe)
      if (srcMatch) {
        const value = applyScale(srcMatch[1], srcMatch[2])
        const srcUnit = srcMatch[3].trim()
        if (unitConversions.temperature[srcUnit.toLowerCase()]) {
          const result = convertTemperature(value, srcUnit, targetUnitStr)
          if (result !== null)
            return {
              value: result,
              unit: targetUnitStr,
              category: 'temperature',
              hasUnit: true,
              isConverted: true,
            }
        }
      }
    }

    // Fuel economy special case (needs special inverse handling for l/100km)
    if (unitConversions.fueleconomy[targetUnitStr.toLowerCase()] !== undefined) {
      const srcFuelRe = new RegExp(`^${SCALED_NUM_RE}\\s+(.+)$`)
      const srcMatch = sourceExpr.match(srcFuelRe)
      if (srcMatch) {
        const value = applyScale(srcMatch[1], srcMatch[2])
        const srcUnit = srcMatch[3].trim()
        if (unitConversions.fueleconomy[srcUnit.toLowerCase()] !== undefined) {
          const result = convertFuelEconomy(value, srcUnit, targetUnitStr)
          if (result !== null)
            return {
              value: result,
              unit: targetUnitStr,
              category: 'fueleconomy',
              hasUnit: true,
              isConverted: true,
            }
        }
      }
    }

    if (targetInfo) {
      // Fuel economy uses special conversion (not simple factor division)
      if (targetInfo.category === 'fueleconomy') {
        // Already handled above, skip general path
      } else if (
        targetInfo.category === 'css' ||
        isCSSBridgeConversion(sourceExpr, targetUnitStr)
      ) {
        const bridgeResult = handleCSSBridge(sourceExpr, targetUnitStr)
        if (bridgeResult) return bridgeResult
      }

      if (targetInfo.category !== 'fueleconomy') {
        const sourceValue = parseUnitExpression(sourceExpr, targetInfo.category)
        if (sourceValue !== null) {
          const result = sourceValue / targetInfo.factor
          return {
            value: result,
            unit: targetUnitStr,
            category: targetInfo.category,
            hasUnit: true,
            isConverted: true,
          }
        }
      }
    }

    const bridgeResult = handleCSSBridge(sourceExpr, targetUnitStr)
    if (bridgeResult) return bridgeResult
  }

  // Compound unit expression: "1 meter 20 cm"
  const compoundResult = parseCompoundUnits(normalized)
  if (compoundResult) return compoundResult

  // Simple "N unit" (no conversion), with optional scale
  const simpleEndRe = new RegExp(`^${SCALED_NUM_RE}\\s+(.+)$`)
  const simpleMatch = normalized.match(simpleEndRe)
  if (simpleMatch) {
    const value = applyScale(simpleMatch[1], simpleMatch[2])
    const unitStr = simpleMatch[3].trim()
    const unitInfo = findUnitCategory(unitStr)
    if (unitInfo) {
      return {
        value,
        unit: unitStr,
        category: unitInfo.category,
        hasUnit: true,
        isConverted: false,
      }
    }
  }

  // Standalone expression with embedded unit and arithmetic (no conversion target).
  // Handles: "(25 cm * 6 + 5%)", "25 cm * 6 + 5%", "20% of what is 30 cm"
  // Strategy: find a unit in the expression, strip it, evaluate the remaining math,
  // and return the result tagged with that unit.
  {
    const unitCandidateRe = /\b([a-zA-Z][a-zA-Z\s]*[a-zA-Z]|[a-zA-Z])\b/g
    let um
    let bestUnit = null
    let bestInfo = null
    while ((um = unitCandidateRe.exec(normalized)) !== null) {
      const candidate = um[1].trim()
      // Skip words that are math keywords, not units
      if (
        /^(of|what|is|on|off|as|a|in|to|and|plus|minus|times|with|without|mod|xor|divide|multiplied|by|subtract)$/i.test(
          candidate,
        )
      )
        continue
      const info = findUnitCategory(candidate)
      if (info) {
        if (!bestUnit || candidate.length > bestUnit.length) {
          bestUnit = candidate
          bestInfo = info
        }
      }
    }
    if (bestUnit && bestInfo) {
      const escaped = bestUnit
        .split('')
        .map((ch) => {
          if ('.+*?^[]{}()|\\'.indexOf(ch) >= 0) return '\\' + ch
          return ch
        })
        .join('')
      const unitRe = new RegExp('\\b' + escaped + '\\b', 'gi')
      const stripped = normalized.replace(unitRe, '').trim()
      try {
        const value = evaluateMath(stripped)
        return {
          value,
          unit: bestUnit,
          category: bestInfo.category,
          hasUnit: true,
          isConverted: true,
        }
      } catch (_e) {
        /* fall through */
      }
    }
  }

  return noResult
}
