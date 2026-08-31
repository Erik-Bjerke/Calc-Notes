// Scale helpers for parsing shorthand big numbers (2k, 1.5M, 3 million, etc.)
import { scales } from './constants'

export const SCALE_SUFFIX =
  '(?:[kK]|M|thousand|thousands|million|millions|billion|billions|trillion|trillions)'
export const SCALED_NUM_RE = `(-?\\d+(?:\\.\\d+)?)\\s*(${SCALE_SUFFIX})?`

// Resolve a number string + optional scale suffix to a numeric value
export const applyScale = (numStr, scaleSuffix) => {
  const base = parseFloat(numStr)
  if (!scaleSuffix) return base
  const key = scaleSuffix.toLowerCase()
  if (key === 'k') return base * 1e3
  if (scaleSuffix === 'M') return base * 1e6
  const multiplier = scales[key]
  return multiplier ? base * multiplier : base
}
